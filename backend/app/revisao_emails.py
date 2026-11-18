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
import html
import mailbox
import re
import shutil
import tarfile
import tempfile
import unicodedata
import zipfile
from dataclasses import dataclass, field
from datetime import date, datetime
from email import policy
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
    r"\bcorrigimos\b",
    r"correcao (do|no|de|dos|nos) (laudo|resultado|valor)",
    r"re-?emiti\w*|re-?emissao",
    r"novo laudo|laudo (atualizado|alterado|corrigido|retificado)|nova versao do laudo",
    r"(houve|ocorreu|identificamos|constatamos|verificamos|encontramos) (um |uma )?"
    r"(erro|equivoco|falha|inconsistencia|divergencia)",
    r"\berro (de |na |no )?(digitacao|transcricao|liberacao|cadastro|lancamento|interno|nosso|analitico)",
    r"\bequivoco\b",
    r"pedimos (sinceras )?(desculpas|perdao)|lamentamos (o|pelo) (ocorrido|transtorno)|desculpe(m)? (pelo|o) transtorno",
    r"(resultado|laudo|valor)(es|s)? (ja )?(foi|foram|esta|estao) (devidamente )?"
    r"(ajustad|alterad|atualizad|corrigid|retificad)\w*",
    r"\bajustamos\b|\balteramos\b",
]
_CORRETO = [
    r"(resultado|valor|laudo)(es|s)? (esta|estao|foi|foram|encontra-se|encontram-se|se encontra|"
    r"permanece|permanecem|segue|seguem|e|sao) (correto|corretos|correta|confirmad\w*|mantid\w*|"
    r"ratificad\w*|condizente|compativel|fidedigno)",
    r"confirmamos (o|os|a|as) (resultado|valor|laudo|achado)",
    r"\bratific\w*",
    r"mantemos (o|os) (resultado|valor|laudo)",
    r"(resultado|valor)(es|s)? (se )?mant(em|eve|iveram|ido)",
    r"conforme (liberado|o laudo|laudo liberado|o resultado liberado)",
    r"(repetimos|refizemos|reprocessamos|reanalisamos|reavaliamos|revisamos|conferimos)[^.]{0,120}"
    r"(confirm\w*|mesmo resultado|se manteve|reprodu\w*|correto|sem alteracao)",
    r"mesmo resultado",
    r"(esta|estao|estava|estavam) corret[oa]s?",
    r"#{6,}",
]
_RE_ERRO = [re.compile(p) for p in _ERRO]
_RE_CORRETO = [re.compile(p) for p in _CORRETO]


def _frase(texto: str, ini: int, fim: int) -> str:
    a = max(texto.rfind(".", 0, ini), texto.rfind("\n", 0, ini)) + 1
    b_ponto, b_linha = texto.find(".", fim), texto.find("\n", fim)
    cands = [x for x in (b_ponto, b_linha) if x != -1]
    b = min(cands) + 1 if cands else len(texto)
    return re.sub(r"\s+", " ", texto[a:b]).strip()[:300]


def classificar_resposta(texto: str) -> tuple[str, str]:
    """(conclusao, trecho). `texto` é a nossa resposta (sem citações)."""
    original = texto or ""
    if not original.strip():
        return "nao_identificado", ""
    # Mesma posição de caracteres no texto normalizado (só tira acento/caixa).
    base = _sem_acento(original)
    if len(base) != len(original):
        original = base
    # Troca a frase negada por "#" do mesmo tamanho (as posições continuam
    # valendo para recortar o trecho do texto original).
    marcado = _NEGACAO.sub(lambda m: "#" * len(m.group(0)), base)
    marcado = _NAO_CORRIGIR.sub(lambda m: "#" * len(m.group(0)), marcado)

    def achados(regras):
        out = []
        for r in regras:
            for m in r.finditer(marcado):
                out.append(m.span())
        return sorted(out)

    erros, certos = achados(_RE_ERRO), achados(_RE_CORRETO)
    if erros and not certos:
        return "erro_nosso", _frase(original, *erros[0])
    if certos and not erros:
        return "correto", _frase(original, *certos[0])
    if erros and certos:
        return "nao_identificado", _frase(original, *min(erros[0], certos[0]))
    return "nao_identificado", ""


# ------------------------------------------------------------------- e-mails

@dataclass
class Mensagem:
    thread: str
    assunto: str
    de: str
    para: list[str]
    data: datetime | None
    texto: str


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


def ler_mbox(caminho: Path):
    """Gera Mensagem de cada e-mail do .mbox (lendo um por vez)."""
    caixa = mailbox.mbox(
        str(caminho), factory=lambda f: email.message_from_binary_file(f, policy=policy.default), create=False
    )
    try:
        for msg in caixa:
            if msg is None:
                continue
            try:
                assunto = str(msg.get("subject") or "")
                de = (_endereco(msg.get("from")) or [""])[0]
                para = _endereco(msg.get("to")) + _endereco(msg.get("cc"))
                try:
                    dt = parsedate_to_datetime(str(msg.get("date"))) if msg.get("date") else None
                    if dt is not None and dt.tzinfo is not None:
                        dt = dt.replace(tzinfo=None)
                except Exception:  # noqa: BLE001
                    dt = None
                thrid = str(msg.get("x-gm-thrid") or "").strip()
                yield Mensagem(thread=thrid, assunto=assunto, de=de, para=para, data=dt,
                               texto=sem_citacao(_corpo(msg)))
            except Exception:  # noqa: BLE001
                continue
    finally:
        caixa.close()


def extrair_mboxes(arquivo: Path, destino: Path) -> list[Path]:
    """Aceita .mbox, ou .zip/.tgz do Takeout com um ou mais .mbox dentro."""
    nome = arquivo.name.lower()
    saida: list[Path] = []
    if nome.endswith(".zip"):
        with zipfile.ZipFile(arquivo) as z:
            for i, info in enumerate(z.infolist()):
                if info.filename.lower().endswith(".mbox") and not info.is_dir():
                    alvo = destino / f"{i}.mbox"  # nunca usa o nome de dentro do zip como caminho
                    with z.open(info) as src, open(alvo, "wb") as dst:
                        shutil.copyfileobj(src, dst)
                    saida.append(alvo)
    elif nome.endswith((".tgz", ".tar.gz", ".tar")):
        with tarfile.open(arquivo) as t:
            for i, info in enumerate(t.getmembers()):
                if info.isfile() and info.name.lower().endswith(".mbox"):
                    src = t.extractfile(info)
                    if src is None:
                        continue
                    alvo = destino / f"{i}.mbox"
                    with src, open(alvo, "wb") as dst:
                        shutil.copyfileobj(src, dst)
                    saida.append(alvo)
    else:
        saida.append(arquivo)
    return saida


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


def nossa_resposta(conversa: Conversa, dominio: str) -> str:
    """Texto das nossas mensagens para a clínica (a mais recente primeiro)."""
    dominio = dominio.lower().lstrip("@")

    def nossa(m: Mensagem) -> bool:
        return m.de.endswith("@" + dominio)

    def para_fora(m: Mensagem) -> bool:
        return any(not a.endswith("@" + dominio) for a in m.para)

    nossas = [m for m in conversa.mensagens if nossa(m)]
    externas = [m for m in nossas if para_fora(m)] or nossas
    return "\n\n".join(m.texto for m in reversed(externas) if m.texto)


def pedido_da_clinica(conversa: Conversa, dominio: str) -> str:
    for m in conversa.mensagens:
        if not m.de.endswith("@" + dominio.lower().lstrip("@")) and m.texto:
            return m.texto[:2000]
    return ""


def processar(db: Session, mboxes: list[Path], dominio: str = DOMINIO_PADRAO) -> dict:
    mensagens = (m for caminho in mboxes for m in ler_mbox(caminho))
    conversas = agrupar(mensagens)
    total_emails = sum(len(c.mensagens) for c in conversas.values())
    por_thread = {c.chave[2:]: c for c in conversas.values() if c.chave.startswith("t:")}
    lista = list(conversas.values())

    res = {"emails": total_emails, "conversas": len(conversas), "revisoes": 0, "ligados": 0,
           "erro_nosso": 0, "correto": 0, "nao_identificado": 0, "sem_email": 0,
           "sem_resposta": 0, "manuais": 0}
    chamados = [c for c in db.scalars(select(Chamado)) if eh_revisao(c.motivo)]
    res["revisoes"] = len(chamados)
    for ch in chamados:
        if ch.conclusao_origem == "manual" and ch.conclusao:
            res["manuais"] += 1
            continue
        tid = thread_do_link(ch.link_gmail)
        conversa = por_thread.get(tid) if tid else None
        if conversa is None:
            conversa = _ligar_por_assunto(ch, lista)
        if conversa is None:
            res["sem_email"] += 1
            continue
        res["ligados"] += 1
        resposta = nossa_resposta(conversa, dominio)
        if not resposta:
            res["sem_resposta"] += 1
            conclusao, trecho = "nao_identificado", "Sem resposta nossa na conversa exportada."
        else:
            conclusao, trecho = classificar_resposta(resposta)
            if not trecho:
                trecho = re.sub(r"\s+", " ", resposta).strip()[:300]
        ch.conclusao, ch.conclusao_origem, ch.conclusao_trecho = conclusao, "email", trecho
        if not ch.texto:
            ch.texto = pedido_da_clinica(conversa, dominio)
        res[conclusao] += 1
    db.commit()
    return res


def processar_arquivo(db: Session, arquivo: Path, dominio: str = DOMINIO_PADRAO) -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        mboxes = extrair_mboxes(arquivo, Path(tmp))
        if not mboxes:
            raise ValueError("Nenhum arquivo .mbox encontrado no envio.")
        return processar(db, mboxes, dominio)
