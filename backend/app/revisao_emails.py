"""Conclusão das revisões de resultado a partir dos e-mails do Gmail.

A Caixa de chamados sabe *que* a clínica pediu revisão, mas não *o que* foi
respondido. Aqui lemos uma exportação do Gmail (Google Takeout: arquivo .mbox,
ou o .zip/.tgz que o Takeout entrega), juntamos as mensagens por conversa,
ligamos cada conversa ao chamado e lemos a NOSSA resposta para concluir:

  erro_nosso        — o resultado foi corrigido/retificado/reemitido;
  correto           — o resultado foi confirmado/mantido;
  nao_identificado  — a resposta não deixa claro (ou cita os dois casos).

Ligação conversa ↔ chamado:
  1) pelo código da conversa no link do Gmail (#inbox/19be0d…): é o mesmo
     número que o Takeout grava em X-GM-THRID (em hexadecimal no link);
  2) sem esse código, pelo assunto (sem "Re:", "Enc:"…) e pela data.

Classificação manual (feita na tela) nunca é sobrescrita.
"""
from __future__ import annotations

import email
import email.parser
import html
import re
import tarfile
import unicodedata
import zipfile
from dataclasses import dataclass, field
from datetime import date, datetime
from email import policy
from email.header import decode_header, make_header
from email.utils import getaddresses, parsedate_to_datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Chamado

CONCLUSOES = {
    "erro_nosso": "Erro nosso (corrigido)",
    "correto": "Resultado estava correto",
    "nao_identificado": "Não identificado",
}
MOTIVO_REVISAO = "Revisão de resultado"
DOMINIO_PADRAO = "alchemypet.com.br"


def _sem_acento(s: str) -> str:
    s = "".join(c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn")
    return s.lower()


def eh_revisao(motivo: str) -> bool:
    return _sem_acento(motivo).strip() == _sem_acento(MOTIVO_REVISAO)


# --------------------------------------------------------------- classificar

# Frases negadas viram "correto" antes de procurar sinais de erro
# ("não houve erro" não pode contar como erro).
_NEGACAO = re.compile(
    r"\b(nao|sem)\s+(houve|ha|foi|foram|ocorreu|identificamos|identificado|constatamos|constatado|"
    r"encontramos|encontrado|existe|existiu|tivemos)?\s*(nenhum|nenhuma|qualquer)?\s*"
    r"(erro|equivoco|falha|inconsistencia|divergencia|alteracao|necessidade de (correcao|retificacao|alteracao))"
)
_NAO_CORRIGIR = re.compile(r"\bnao\s+(sera|foi|precisa|e necessari\w*|ha necessidade de)\s+(ser\s+)?"
                           r"(corrigid|retificad|alterad|reemitid|ajustad)\w*")

_ERRO = [
    r"retific\w*",
    r"\bcorrigid[oa]s?\b",
    r"\b(corrigimos|corrigi|atualizei|atualizamos|retifiquei|ajustei|ajustamos|alteramos)\b",
    r"correcao (do|no|de|dos|nos) (laudo|resultado|valor)",
    r"re-?emiti\w*|re-?emissao",
    r"novo laudo|nova versao do laudo",
    r"\blaudos? (atualizado|alterado|corrigido|retificado)s?\b",
    r"atualizacao do (resultado|laudo)",
    r"(houve|ocorreu|identificamos|constatamos|verificamos|encontramos|tinha dado|deu) (um |uma )?"
    r"(erro|equivoco|falha|inconsistencia|divergencia)",
    r"\b(e |foi )?(um )?erro (de |na |no |da |do )?(digitacao|transcricao|liberacao|cadastro|lancamento|"
    r"interno|nosso|analitico|mascara|sistema|pipetagem)",
    r"falha (na|da|de|no) (pipetagem|digitacao|liberacao|analise|cadastro)",
    r"\bequivoco\b",
    r"(resultado|laudo|valor|guia)(es|s)? (ja )?(foi|foram|esta|estao) (devidamente )?"
    r"(ajustad|alterad|atualizad|corrigid|retificad)\w*",
    r"\bajustad[oa]s?\b|ajustes? (ja )?(foram|foi) (realizad|feit)\w*",
    r"guia \d+ (ja )?(foi|foram) atualizad",
    r"perdao pela liberacao|liberad[oa] (por engano|errad)",
    r"(iremos|vamos) (atualizar|corrigir|retificar) o laudo",
    r"\bequivoquei\b|\bnos equivocamos\b",
    r"o outro sera excluido",
]
# Erros "fortes": quando a mesma mensagem também confirma algo (ex.: "retificamos
# o laudo, porém o hematócrito continua baixo"), a correção prevalece.
_ERRO_FORTE = re.compile(r"retific|corrigid|corrigimos|laudos? (foi |foram |ja foi )?atualizad|equivoco|"
                         r"(houve|ocorreu|tinha dado) (um |uma )?(erro|falha)|erro na|falha (na|da)")
_CORRETO = [
    r"(resultado|valor|laudo)(es|s)? (esta|estao|foi|foram|encontra-se|encontram-se|se encontra|"
    r"permanece|permanecem|segue|seguem|e|sao) (correto|corretos|correta|confirmad\w*|mantid\w*|"
    r"ratificad\w*|condizente|compativel|fidedigno)",
    r"confirmamos (o|os|a|as) (resultado|valor|laudo|achado)",
    r"\bratific\w*",
    r"mantemos (o|os) (resultado|valor|laudo)",
    r"\bse mant(em|eve|iveram)\b|\bmantendo-se\b|\bpermanece(m)? (para|com|em|o|a|elevad|baix)",
    r"conforme (liberado|o laudo|laudo liberado|o resultado liberado)",
    r"(repetimos|refizemos|reprocessamos|reanalisamos|reavaliamos|revisamos|conferimos)[^.]{0,120}"
    r"(confirm\w*|mesmo resultado|reprodu\w*|correto|sem alteracao)",
    r"\b(repetid|revisad|verificad|conferid|reavaliad)[oa]s? e confirmad[oa]s?",
    r"\bresultados? (repetidos? e )?confirmad[oa]s?",
    r"confirmad[oa] (por|em) (meio de )?(analise|lamina)|(que )?confirma(m)? (isso|o resultado)",
    r"mesmo resultado",
    r"(esta|estao|estava|estavam) corret[oa]s?",
    r"\be isso mesmo\b",
    r"compativ\w* com (o|os|a|as) (resultado|liberad|liberac)\w*|em concordancia com o resultado",
    r"resultado originalmente liberado",
    r"\b(revisamos|verificamos|reavaliamos|reanalisamos)[^.]{0,80}(realmente|nao ha presenca|nao foram identificad)",
    r"\breavaliamos e realmente\b",
    r"fizemos a confirmacao|liberad[oa]s? (corretamente|de acordo com)|(encontra-se|encontram-se) corret",
    r"\b(deu|foi|foram|houve) realmente\b|\brealmente,? (houve|foram|foi|deu)\b",
    r"nao identificaram intercorrencias|dentro (dos|do) (padroes|parametros|limites|valores)",
    r"#{6,}",
]
_RE_ERRO = [re.compile(p) for p in _ERRO]
_RE_CORRETO = [re.compile(p) for p in _CORRETO]

# O que não é a nossa conclusão: perguntas e pedidos (muitas vezes a pergunta
# da clínica repassada internamente) e trechos citados entre aspas.
_PERGUNTA = re.compile(
    r"\?|\bgostaria(mos)? de (saber|confirmar|entender|verificar|pedir|solicitar|refazer|falar)|\bpoderi(a|am)\b|\bpode(m)? (por favor |por gentileza )?(verificar|revisar|repetir|confirmar|"
    r"ver|conferir|checar|refazer)|\bquer(ia|em)? saber|\b(verificar|confirmar|conferir|checar) se\b|"
    r"segue (o |a )?(questionamento|solicitacao|mensagem)|\bsolicit(a|ou|ando|ou-se) (a )?(revisao|confirmacao|"
    r"correcao)|esta certo mesmo|\bprecis(o|amos) (que|da confirmacao)|\bpedindo (correcao|revisao)"
)
_CITADO = re.compile(r"\"[^\"]{0,800}\"|“[^”]{0,800}”")
_RUIDO = re.compile(r"\(\s*\d{10,13}\s*\)|\[image[^\]]*\]")


def _frases(texto: str) -> list[str]:
    # O texto puro do Gmail quebra a linha no meio da frase (~76 colunas):
    # junta as linhas e só separa em parágrafo (linha em branco) ou pontuação.
    texto = (texto or "").replace("\r\n", "\n")
    texto = re.sub(r"(?<!\n)\n(?!\n)", " ", texto)
    texto = _CITADO.sub(" ", texto)
    partes = re.split(r"(?<=[.!?])\s+|\n\s*\n+", texto)
    out = []
    for p in partes:
        p = re.sub(r"\s+", " ", p).strip()
        if not p or _RUIDO.search(p):
            continue
        if _PERGUNTA.search(_sem_acento(p)):
            continue
        out.append(p)
    return out


def _sinal(frase: str) -> tuple[bool, bool, bool]:
    """(erro, correto, erro_forte) numa frase."""
    base = _sem_acento(frase)
    base = _NEGACAO.sub(lambda m: "#" * len(m.group(0)), base)
    base = _NAO_CORRIGIR.sub(lambda m: "#" * len(m.group(0)), base)
    erro = any(r.search(base) for r in _RE_ERRO)
    certo = any(r.search(base) for r in _RE_CORRETO)
    return erro, certo, bool(erro and _ERRO_FORTE.search(base))


def _decidir(texto: str) -> tuple[str, str] | None:
    """Conclusão de uma mensagem, ou None se ela não diz nada conclusivo."""
    erros, certos, forte = [], [], False
    for f in _frases(texto):
        e, c, fo = _sinal(f)
        if e:
            erros.append(f)
            forte = forte or fo
        if c:
            certos.append(f)
    if erros and not certos:
        return "erro_nosso", erros[0][:300]
    if certos and not erros:
        return "correto", certos[0][:300]
    if erros and certos:
        if forte:
            return "erro_nosso", erros[0][:300]
        return "nao_identificado", erros[0][:300]
    return None


def classificar_resposta(texto: str) -> tuple[str, str]:
    """(conclusao, trecho) de uma resposta nossa."""
    return _decidir(texto) or ("nao_identificado", "")


def classificar_conversa(respostas: list[str]) -> tuple[str, str]:
    """Nossas mensagens, da mais recente para a mais antiga: vale a mais
    recente que conclui algo (a última palavra do laboratório)."""
    for r in respostas:
        d = _decidir(r)
        if d and d[0] != "nao_identificado":
            return d
    for r in respostas:
        d = _decidir(r)
        if d:
            return d
    primeira = next((r for r in respostas if r.strip()), "")
    return "nao_identificado", re.sub(r"\s+", " ", primeira).strip()[:300]


# ------------------------------------------------------------------- e-mails

@dataclass
class Mensagem:
    thread: str
    assunto: str
    de: str
    para: list[str]
    data: datetime | None
    texto: str
    # Assunto do chamado na planilha, quando quem exportou já sabia de qual
    # chamado é a conversa (script do Google: cabeçalho X-Alchemypet-Chamado).
    chamado: str = ""


@dataclass
class Conversa:
    chave: str
    assunto: str
    mensagens: list[Mensagem] = field(default_factory=list)

    @property
    def inicio(self) -> date | None:
        ds = [m.data for m in self.mensagens if m.data]
        return min(ds).date() if ds else None


_PREFIXO = re.compile(r"^\s*((re|res|enc|fw|fwd|tr|rv|aw)\s*(\[\d+\])?\s*:\s*)+", re.I)
_CITACAO = re.compile(
    r"(?is)(\n[ \t]*(em|on)\s[^\n]{0,250}?(\n[^\n]{0,250}?)?(escreveu|wrote)\s*:)"
    r"|(\n[ \t]*-{2,}\s*(mensagem original|original message|forwarded message|mensagem encaminhada)\s*-{2,})"
    r"|(\n[ \t]*(de|from)\s*:\s[^\n]+\n[ \t]*(enviad[oa]|sent|data|date)\s*:)"
)


def assunto_base(s: str) -> str:
    s = _PREFIXO.sub("", s or "")
    return re.sub(r"\s+", " ", _sem_acento(s)).strip(" -–:")


def _texto_html(h: str) -> str:
    h = re.sub(r"(?is)<(script|style).*?</\1>", " ", h)
    h = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</tr>|</li>", "\n", h)
    h = re.sub(r"(?is)<blockquote.*?</blockquote>", "\n", h)
    return html.unescape(re.sub(r"<[^>]+>", " ", h))


def _corpo(msg) -> str:
    try:
        parte = msg.get_body(preferencelist=("plain", "html"))
        if parte is None:
            return ""
        conteudo = parte.get_content()
        if parte.get_content_subtype() == "html":
            conteudo = _texto_html(conteudo)
        return str(conteudo)
    except Exception:  # noqa: BLE001 — e-mail malformado: segue sem o corpo
        return ""


def sem_citacao(texto: str) -> str:
    texto = "\n" + (texto or "").replace("\r\n", "\n")
    m = _CITACAO.search(texto)
    if m:
        texto = texto[: m.start()]
    linhas = [ln for ln in texto.split("\n") if not ln.lstrip().startswith(">")]
    return "\n".join(linhas).strip()


def _endereco(v) -> list[str]:
    try:
        return [a.lower() for _, a in getaddresses([str(v or "")]) if a]
    except Exception:  # noqa: BLE001
        return []


# Leitura em fluxo, sem extrair o .zip para o disco: o Takeout costuma ter
# vários GB (anexos com laudos). Primeiro olhamos só o cabeçalho de cada
# e-mail; o corpo só é lido quando a conversa interessa (é de um chamado de
# revisão). Assim o arquivo inteiro é percorrido uma vez, sem abrir anexos.

def _cabecalho(bruto: bytes):
    return email.parser.BytesHeaderParser(policy=policy.compat32).parsebytes(bruto)


def _decodificar(v) -> str:
    if v is None:
        return ""
    try:
        return str(make_header(decode_header(str(v))))
    except Exception:  # noqa: BLE001
        return str(v)


def _mensagem(bruto: bytes, cab) -> Mensagem | None:
    try:
        msg = email.message_from_bytes(bruto, policy=policy.default)
    except Exception:  # noqa: BLE001
        return None
    try:
        dt = parsedate_to_datetime(str(cab.get("date"))) if cab.get("date") else None
        if dt is not None and dt.tzinfo is not None:
            dt = dt.replace(tzinfo=None)
    except Exception:  # noqa: BLE001
        dt = None
    return Mensagem(
        thread=str(cab.get("x-gm-thrid") or "").strip(),
        assunto=_decodificar(cab.get("subject")),
        de=(_endereco(cab.get("from")) or [""])[0],
        para=_endereco(cab.get("to")) + _endereco(cab.get("cc")),
        data=dt,
        texto=sem_citacao(_corpo(msg)),
        chamado=_decodificar(cab.get("x-alchemypet-chamado")).strip(),
    )


def ler_fluxo(fluxo, interessa, progresso=None):
    """Percorre um .mbox (fluxo binário) e gera Mensagem só dos e-mails em que
    `interessa(thread, assunto)` é verdadeiro. `progresso(bytes, emails)`."""
    lidos = emails = 0
    cab_linhas: list[bytes] = []
    corpo: list[bytes] | None = None
    no_cabecalho = False
    cab = None

    def fechar():
        nonlocal emails
        if cab is not None and corpo is not None:
            return _mensagem(b"".join(cab_linhas) + b"\n" + b"".join(corpo), cab)
        return None

    for linha in fluxo:
        lidos += len(linha)
        if linha.startswith(b"From "):
            m = fechar()
            if m:
                yield m
            emails += 1
            if progresso and emails % 500 == 0:
                progresso(lidos, emails)
            cab_linhas, corpo, cab, no_cabecalho = [], None, None, True
            continue
        if no_cabecalho:
            if linha in (b"\n", b"\r\n"):
                no_cabecalho = False
                cab = _cabecalho(b"".join(cab_linhas))
                thread = str(cab.get("x-gm-thrid") or "").strip()
                if cab.get("x-alchemypet-chamado") or interessa(thread, _decodificar(cab.get("subject"))):
                    corpo = []
            else:
                cab_linhas.append(linha)
        elif corpo is not None:
            corpo.append(linha)
    m = fechar()
    if m:
        yield m
    if progresso:
        progresso(lidos, emails)


def abrir_mboxes(arquivo: Path):
    """Gera (fluxo binário, tamanho) de cada .mbox: o próprio arquivo, ou os
    .mbox de dentro do .zip/.tgz do Takeout (lidos direto, sem extrair)."""
    nome = arquivo.name.lower()
    if nome.endswith(".zip"):
        with zipfile.ZipFile(arquivo) as z:
            for info in z.infolist():
                nome_int = info.filename.replace("\\", "/")
                if (nome_int.lower().endswith(".mbox") and not info.is_dir()
                        and "__MACOSX/" not in nome_int and not nome_int.split("/")[-1].startswith("._")):
                    with z.open(info) as f:
                        yield f, info.file_size
    elif nome.endswith((".tgz", ".tar.gz", ".tar")):
        with tarfile.open(arquivo) as t:
            for info in t:
                if info.isfile() and info.name.lower().endswith(".mbox"):
                    f = t.extractfile(info)
                    if f is not None:
                        with f:
                            yield f, info.size
    else:
        with open(arquivo, "rb") as f:
            yield f, arquivo.stat().st_size


def agrupar(mensagens) -> dict[str, Conversa]:
    conversas: dict[str, Conversa] = {}
    for m in mensagens:
        chave = f"t:{m.thread}" if m.thread else f"s:{assunto_base(m.assunto)}"
        c = conversas.get(chave)
        if c is None:
            c = conversas[chave] = Conversa(chave=chave, assunto=m.assunto)
        c.mensagens.append(m)
    for c in conversas.values():
        c.mensagens.sort(key=lambda x: x.data or datetime.min)
    return conversas


# ----------------------------------------------------------------- ligar

_HEX = re.compile(r"(?:#[a-z]+/|/)([0-9a-f]{16})(?:[?&#/]|$)")


def thread_do_link(link: str) -> str:
    """Código da conversa (X-GM-THRID, decimal) a partir do link do Gmail."""
    m = _HEX.search((link or "").strip().lower())
    return str(int(m.group(1), 16)) if m else ""


def _palavras(s: str) -> set[str]:
    return {p for p in re.findall(r"[a-z0-9]+", s) if len(p) > 2 or p.isdigit()}


def _semelhanca(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    if a in b or b in a:
        return 0.9
    pa, pb = _palavras(a), _palavras(b)
    if not pa or not pb:
        return 0.0
    # Números (pedido, guia) pesam: se o chamado tem um e a conversa não, não é ela.
    na, nb = {p for p in pa if p.isdigit()}, {p for p in pb if p.isdigit()}
    if na and nb and not (na & nb):
        return 0.0
    # Todas as palavras do chamado estão no assunto do e-mail (que tem mais).
    if len(pa) >= 2 and pa <= pb:
        return 0.85
    return len(pa & pb) / len(pa | pb)


def _ligar_por_assunto(ch: Chamado, conversas: list[Conversa]) -> Conversa | None:
    alvo = assunto_base(ch.assunto)
    melhor, nota_melhor, empate = None, 0.0, False
    for c in conversas:
        nota = _semelhanca(alvo, assunto_base(c.assunto))
        if nota < 0.6:
            continue
        if ch.data and c.inicio and abs((c.inicio - ch.data).days) > 5:
            continue
        if nota > nota_melhor:
            melhor, nota_melhor, empate = c, nota, False
        elif nota == nota_melhor:
            empate = True
    return None if empate else melhor


def nossas_respostas(conversa: Conversa, dominio: str) -> list[str]:
    """Textos das nossas mensagens, da mais recente para a mais antiga.
    Inclui as internas: muitas vezes quem conclui é o técnico ("Laudo
    atualizado, favor avisar a clínica")."""
    dominio = dominio.lower().lstrip("@")
    return [m.texto for m in reversed(conversa.mensagens) if m.de.endswith("@" + dominio) and m.texto]


def pedido_da_clinica(conversa: Conversa, dominio: str) -> str:
    for m in conversa.mensagens:
        if not m.de.endswith("@" + dominio.lower().lstrip("@")) and m.texto:
            return m.texto[:2000]
    return ""


class _Alvos:
    """O que procurar no arquivo: as conversas dos chamados de revisão."""

    def __init__(self, chamados: list[Chamado]):
        self.threads = {t for t in (thread_do_link(c.link_gmail) for c in chamados) if t}
        self.assuntos = [assunto_base(c.assunto) for c in chamados if c.assunto]
        # Índice palavra → assuntos, ignorando palavras comuns a muitos chamados.
        indice: dict[str, set[int]] = {}
        for i, a in enumerate(self.assuntos):
            for p in _palavras(a):
                indice.setdefault(p, set()).add(i)
        limite = max(5, len(self.assuntos) // 10)
        self.indice = {p: ids for p, ids in indice.items() if len(ids) <= limite}
        self._cache: dict[str, bool] = {}

    def interessa(self, thread: str, assunto: str) -> bool:
        if thread and thread in self.threads:
            return True
        base = assunto_base(assunto)
        if not base:
            return False
        if base in self._cache:
            return self._cache[base]
        candidatos: set[int] = set()
        for p in _palavras(base):
            candidatos |= self.indice.get(p, set())
        ok = any(_semelhanca(self.assuntos[i], base) >= 0.6 for i in candidatos)
        if len(self._cache) < 200_000:
            self._cache[base] = ok
        return ok


def processar(db: Session, arquivo: Path, dominio: str = DOMINIO_PADRAO, progresso=None) -> dict:
    chamados = [c for c in db.scalars(select(Chamado)) if eh_revisao(c.motivo)]
    alvos = _Alvos(chamados)

    mensagens: list[Mensagem] = []
    total_emails = 0
    achou_mbox = False
    for fluxo, tamanho in abrir_mboxes(arquivo):
        achou_mbox = True
        base_emails = total_emails

        def avisar(lidos, n, _t=tamanho, _b=base_emails):
            if progresso:
                progresso(fase="lendo", lidos=lidos, tamanho=_t, emails=_b + n)

        contador = {"n": 0}

        def avisar_conta(lidos, n, _f=avisar):
            contador["n"] = n
            _f(lidos, n)

        mensagens.extend(ler_fluxo(fluxo, alvos.interessa, avisar_conta))
        total_emails += contador["n"]
    if not achou_mbox:
        raise ValueError("Nenhum arquivo .mbox encontrado no envio.")
    if progresso:
        progresso(fase="ligando", emails=total_emails)

    conversas = agrupar(mensagens)
    por_thread = {c.chave[2:]: c for c in conversas.values() if c.chave.startswith("t:")}
    lista = list(conversas.values())
    por_chamado: dict[str, Conversa] = {}
    for c in lista:
        for m in c.mensagens:
            if m.chamado:
                por_chamado.setdefault(assunto_base(m.chamado), c)

    res = {"emails": total_emails, "conversas": len(conversas), "revisoes": len(chamados), "ligados": 0,
           "erro_nosso": 0, "correto": 0, "nao_identificado": 0, "sem_email": 0,
           "sem_resposta": 0, "manuais": 0}
    for ch in chamados:
        if ch.conclusao_origem == "manual" and ch.conclusao:
            res["manuais"] += 1
            continue
        tid = thread_do_link(ch.link_gmail)
        conversa = por_thread.get(tid) if tid else None
        if conversa is None:
            conversa = por_chamado.get(assunto_base(ch.assunto))
        if conversa is None:
            conversa = _ligar_por_assunto(ch, lista)
        if conversa is None:
            res["sem_email"] += 1
            continue
        res["ligados"] += 1
        respostas = nossas_respostas(conversa, dominio)
        if not respostas:
            res["sem_resposta"] += 1
            conclusao, trecho = "nao_identificado", "Sem resposta nossa na conversa exportada."
        else:
            conclusao, trecho = classificar_conversa(respostas)
        ch.conclusao, ch.conclusao_origem, ch.conclusao_trecho = conclusao, "email", trecho
        if not ch.texto:
            ch.texto = pedido_da_clinica(conversa, dominio)
        res[conclusao] += 1
    db.commit()
    return res


def processar_arquivo(db: Session, arquivo: Path, dominio: str = DOMINIO_PADRAO, progresso=None) -> dict:
    return processar(db, arquivo, dominio, progresso)
