"""Leitura dos .docx do Relatório Gerencial de Qualidade.

Dois formatos chegam da Qualidade e são reconhecidos automaticamente:

* **executivo** — usa estilos do Word (Title / Heading 1 / Heading 2) e um
  quadro "Item | Status" por setor, com a última linha "Plano de melhoria".
* **completo** — texto corrido com seções numeradas em negrito
  ("1. OBJETIVO"), listas, tabelas e blocos de meses por equipamento.

O parser é tolerante: variações de acento, numeração e caixa não quebram a
leitura, e o que não for reconhecido vira parágrafo comum (nada se perde).
"""
from __future__ import annotations

import re
import unicodedata
from io import BytesIO

import docx
from docx.table import Table as DocxTable
from docx.text.paragraph import Paragraph as DocxParagraph

from .modelo import (
    CartaoMes,
    Destaque,
    GradeMeses,
    ItemStatus,
    Lista,
    Paragrafo,
    Relatorio,
    Secao,
    Setor,
    SubTitulo,
    Tabela,
)

MESES = (
    "janeiro", "fevereiro", "marco", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
)

# Textos que indicam processo sob controle (bolinha verde na matriz).
_OK = (
    "conforme", "em acompanhamento", "em conformidade", "nao se aplica",
    "atualizado", "regular", "ok", "aprovado", "sem pendencia", "concluido",
)
# Mesmo contendo um termo acima, estas palavras puxam para "requer atenção".
_ATENCAO = (
    "vencid", "sem selo", "pendente", "pendencia", "nao identificad",
    "aguardando", "em andamento", "falta", "ausente", "irregular", "atras",
)

_RE_SECAO = re.compile(r"^(\d{1,2})\s*[.)\-–]\s*(.+)$")
# Palavras que ficam em minúscula no meio de um título.
_MINUSCULAS = {
    "de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas",
    "por", "para", "com", "a", "o", "as", "os", "ao", "aos", "à", "às", "ou",
}
# Siglas que permanecem em caixa alta.
_SIGLAS = {"cq", "cqi", "pcr", "dp", "pop", "pops", "sac", "qc"}


def _k(s: str | None) -> str:
    """Chave de comparação: sem acento, minúscula, espaços normalizados."""
    s = "".join(
        c for c in unicodedata.normalize("NFD", s or "")
        if unicodedata.category(c) != "Mn"
    )
    return re.sub(r"\s+", " ", s).strip().lower()


def _norm(s: str | None) -> str:
    return re.sub(r"[ \t]+", " ", (s or "").replace("\xa0", " ")).strip()


def _sem_tracos(s: str) -> str:
    """Travessões/en-dash viram hífen simples, para comparar títulos."""
    return re.sub(r"[\u2010-\u2015]", "-", s or "")


def classificar_situacao(texto: str) -> str:
    """Texto do status → "ok" | "atencao" (bolinha verde ou âmbar)."""
    t = _k(texto)
    if not t:
        return "ok"
    if any(p in t for p in _ATENCAO):
        return "atencao"
    return "ok" if any(p in t for p in _OK) else "atencao"


def _titulo_caixa(s: str) -> str:
    """ALL CAPS → Capitalizado, mantendo siglas conhecidas em caixa alta."""
    s = _norm(s).rstrip(":")
    if not s or s != s.upper():
        return s
    palavras = []
    for i, p in enumerate(s.split(" ")):
        nucleo = _k(p.strip("()/,.:-"))
        if nucleo in _SIGLAS:
            palavras.append(p)
        elif i and nucleo in _MINUSCULAS:
            palavras.append(p.lower())
        elif p[:1].isalpha():
            palavras.append(p[:1] + p[1:].lower())
        else:
            palavras.append(p)
    return " ".join(palavras)


# ----------------------------------------------------------------------
#  Leitura bruta do documento
# ----------------------------------------------------------------------
class _Bloco:
    """Parágrafo ou tabela do .docx, já com os atributos que interessam."""

    def __init__(self, par: DocxParagraph | None = None, tab: DocxTable | None = None):
        self.tabela = tab
        self.estilo = ""
        self.texto = ""
        self.negrito = False
        self.lista = False
        if par is not None:
            self.estilo = par.style.name or ""
            self.texto = _norm(par.text)
            runs = [r for r in par.runs if r.text.strip()]
            self.negrito = bool(runs) and all(r.bold for r in runs)
            pPr = par._p.pPr
            self.lista = pPr is not None and pPr.numPr is not None

    @property
    def e_tabela(self) -> bool:
        return self.tabela is not None


def _blocos(doc) -> list[_Bloco]:
    saida: list[_Bloco] = []
    for filho in doc.element.body.iterchildren():
        if filho.tag.endswith("}p"):
            b = _Bloco(par=DocxParagraph(filho, doc))
            if b.texto:
                saida.append(b)
        elif filho.tag.endswith("}tbl"):
            saida.append(_Bloco(tab=DocxTable(filho, doc)))
    return saida


def _ler_tabela(tab: DocxTable) -> Tabela:
    linhas: list[list[str]] = []
    for r in tab.rows:
        linhas.append([_norm(c.text) for c in r.cells])
    if not linhas:
        return Tabela()
    cabecalho, corpo = linhas[0], linhas[1:]
    larguras = [max((len(l[i]) for l in linhas if i < len(l)), default=0) for i in range(len(cabecalho))]
    compacta = len(cabecalho) >= 5 and all(w <= 12 for w in larguras[1:])
    return Tabela(cabecalho=cabecalho, linhas=corpo, compacta=compacta)


def _partes_plano(texto: str) -> list[str]:
    """Célula "Plano de melhoria" → itens (uma linha ou "; " por item)."""
    bruto = [p.strip(" ;·-•\t") for p in re.split(r"[\n\r]+", texto or "")]
    itens = [p for p in bruto if p]
    if len(itens) == 1 and ";" in itens[0]:
        itens = [p.strip(" ;") for p in itens[0].split(";") if p.strip(" ;")]
    return itens


# ----------------------------------------------------------------------
#  Formato "executivo" (estilos Title / Heading)
# ----------------------------------------------------------------------
def _parece_executivo(blocos: list[_Bloco]) -> bool:
    estilos = {b.estilo for b in blocos}
    return bool({"Heading 1", "Heading 2", "Title"} & estilos)


def _meta_do_quadro(tab: DocxTable) -> dict[str, str]:
    meta: dict[str, str] = {}
    for r in tab.rows:
        celulas = [_norm(c.text) for c in r.cells]
        if len(celulas) >= 2 and celulas[0]:
            meta[_k(celulas[0])] = celulas[1]
    return meta


def _setor_do_quadro(nome: str, tab: DocxTable) -> Setor:
    setor = Setor(nome=_titulo_caixa(nome))
    for r in tab.rows:
        celulas = [_norm(c.text) for c in r.cells]
        if len(celulas) < 2:
            continue
        rotulo, valor = celulas[0], celulas[1]
        chave = _k(rotulo)
        if not rotulo or chave in ("item", "controle"):
            continue
        if "plano" in chave:
            setor.plano = _partes_plano(r.cells[1].text)
            continue
        setor.itens.append(
            ItemStatus(rotulo=rotulo, texto=valor, situacao=classificar_situacao(valor))
        )
    return setor


def _ler_executivo(blocos: list[_Bloco]) -> Relatorio:
    rel = Relatorio(tipo="executivo", chapeu="RELATÓRIO GERENCIAL · VERSÃO EXECUTIVA")
    secao: Secao | None = None
    setor_atual: str | None = None
    i = 0
    while i < len(blocos):
        b = blocos[i]
        if b.e_tabela:
            if setor_atual is not None:
                rel.setores.append(_setor_do_quadro(setor_atual, b.tabela))
                setor_atual = None
            else:
                meta = _meta_do_quadro(b.tabela)
                achou = False
                for chave, valor in meta.items():
                    if "periodo" in chave:
                        rel.periodo, achou = valor, True
                    elif "setor" in chave:
                        rel.setores_contemplados, achou = valor, True
                    elif "destinat" in chave:
                        rel.destinatario, achou = valor, True
                if not achou and secao is not None:
                    secao.blocos.append(_ler_tabela(b.tabela))
            i += 1
            continue

        estilo, texto = b.estilo, b.texto
        if estilo == "Title":
            linhas = [l for l in (b.texto or "").split("\n") if l.strip()]
            bruto = _norm(linhas[0]) if linhas else ""
            rel.documento = _titulo_caixa(bruto)
            titulo = re.sub(r"^relat[óo]rio\s+gerencial\s+(de\s+)?", "", bruto, flags=re.IGNORECASE)
            rel.titulo = _titulo_caixa(titulo) or "Controle da Qualidade"
            if len(linhas) > 1:
                rel.subtitulo = _titulo_caixa(linhas[1])
        elif estilo == "Heading 1":
            m = _RE_SECAO.match(texto)
            secao = Secao(titulo=_titulo_caixa(m.group(2) if m else texto))
            rel.secoes.append(secao)
        elif estilo == "Heading 2":
            setor_atual = texto
        elif not rel.resumo and secao is None:
            rel.resumo = texto
        elif secao is not None:
            if b.lista:
                if secao.blocos and isinstance(secao.blocos[-1], Lista):
                    secao.blocos[-1].itens.append(texto)
                else:
                    secao.blocos.append(Lista(itens=[texto]))
            else:
                secao.blocos.append(Paragrafo(texto=texto))
        i += 1

    if rel.setores_contemplados:
        # Lista separada por vírgula no Word → separador do modelo impresso.
        rel.setores_contemplados = re.sub(
            r"\s*(?:,|\be\b)\s*", " · ", rel.setores_contemplados
        ).strip(" ·")
    elif rel.setores:
        rel.setores_contemplados = " · ".join(s.nome for s in rel.setores)
    pend = sum(1 for s in rel.setores if s.tem_atencao)
    rel.situacao_geral = (
        "PROCESSOS CRÍTICOS SOB CONTROLE" if pend <= len(rel.setores) else "EM AVALIAÇÃO"
    )
    return rel


# ----------------------------------------------------------------------
#  Formato "completo" (seções numeradas em negrito)
# ----------------------------------------------------------------------
def _e_mes(texto: str) -> bool:
    return _k(texto) in MESES


def _ler_completo(blocos: list[_Bloco]) -> Relatorio:
    rel = Relatorio(tipo="completo", chapeu="RELATÓRIO GERENCIAL")
    rel.titulo = "Controles de Qualidade"
    rel.subtitulo = "por Setor"
    parte_atual = ""
    secao: Secao | None = None
    pendente_periodo = False
    setores_vistos: list[str] = []

    def nova_secao(titulo: str) -> Secao:
        nonlocal secao
        secao = Secao(titulo=titulo, parte=parte_atual)
        rel.secoes.append(secao)
        return secao

    def add(bloco) -> None:
        if secao is None:
            nova_secao("Apresentação")
        secao.blocos.append(bloco)

    for idx, b in enumerate(blocos):
        if b.e_tabela:
            add(_ler_tabela(b.tabela))
            continue

        texto = b.texto
        chave = _k(texto)

        if pendente_periodo:
            pendente_periodo = False
            if not rel.periodo:
                rel.periodo = texto
                continue

        # Cabeçalhos do documento que viram metadado, não conteúdo.
        if _sem_tracos(chave).startswith("relatorio gerencial") and not _RE_SECAO.match(texto):
            if not rel.documento:
                rel.documento = texto
            continue
        if chave.startswith("periodo avaliado"):
            pendente_periodo = True
            continue
        if _sem_tracos(chave).startswith("controle de qualidade interno"):
            parte_atual = "PARTE I · " + _sem_tracos(texto).upper()
            rel.resumo = rel.resumo or texto
            continue

        m = _RE_SECAO.match(texto) if b.negrito else None
        if m:
            nova_secao(_titulo_caixa(m.group(2)))
            continue

        # "BIOQUÍMICA:" / "MICROBIOLOGIA" → setor da Parte II.
        e_setor = (
            b.negrito
            and not b.lista
            and texto == texto.upper()
            and 3 <= len(texto) <= 48
            and any(c.isalpha() for c in texto)
            and not any(c.isdigit() for c in texto)
            and not _e_mes(texto)
            and (texto.endswith(":") or len(texto.split()) <= 3)
            and _k(texto).rstrip(":") not in ("relatorio gerencial",)
        )
        if e_setor:
            nome = _titulo_caixa(texto)
            if nome not in setores_vistos:
                setores_vistos.append(nome)
            parte_atual = "PARTE II · CONTROLES DE QUALIDADE POR SETOR"
            nova_secao(nome)
            continue

        if b.lista:
            anterior = secao.blocos[-1] if secao and secao.blocos else None
            if isinstance(anterior, GradeMeses) and anterior.cartoes:
                anterior.cartoes[-1].itens.append(texto)
            elif isinstance(anterior, Lista):
                anterior.itens.append(texto)
            else:
                add(Lista(itens=[texto]))
            continue

        if b.negrito:
            if _e_mes(texto):
                anterior = secao.blocos[-1] if secao and secao.blocos else None
                if isinstance(anterior, GradeMeses):
                    anterior.cartoes.append(CartaoMes(mes=texto))
                else:
                    add(GradeMeses(cartoes=[CartaoMes(mes=texto)]))
            elif len(texto) <= 60 and not texto.endswith("."):
                add(SubTitulo(texto=texto))
            else:
                add(Paragrafo(texto=texto, destaque=True))
            continue

        add(Paragrafo(texto=texto))

    # O .docx intercala as partes (um setor abre o arquivo, o CQI vem depois).
    # A ordem de leitura do relatório é Parte I, Parte II, demais.
    def ordem_parte(s: Secao) -> int:
        m = re.match(r"^parte\s+([ivx]+)", _k(s.parte))
        if not m:
            return 99
        romano = m.group(1).upper()
        return {"I": 1, "II": 2, "III": 3, "IV": 4}.get(romano, 50)

    rel.secoes.sort(key=ordem_parte)

    # "Análise — Equipamento N" e similares viram caixa de destaque.
    for s in rel.secoes:
        novos: list = []
        caixa: Destaque | None = None
        for bloco in s.blocos:
            if isinstance(bloco, SubTitulo) and _k(bloco.texto).startswith("analise"):
                caixa = Destaque(titulo=bloco.texto, tom="roxo")
                novos.append(caixa)
                continue
            if caixa is not None and isinstance(bloco, (Paragrafo, Lista)):
                caixa.blocos.append(bloco)
                continue
            caixa = None
            novos.append(bloco)
        s.blocos = novos

    # Listas curtas e numerosas (analitos) ganham 3 colunas.
    for s in rel.secoes:
        for bloco in s.blocos:
            if isinstance(bloco, Lista) and len(bloco.itens) >= 8:
                if max((len(i) for i in bloco.itens), default=0) <= 14:
                    bloco.colunas = 3

    if not rel.setores_contemplados and setores_vistos:
        rel.setores_contemplados = " · ".join(setores_vistos)
    rel.situacao_geral = "APROVADO"
    return rel


# ----------------------------------------------------------------------
def ler_docx(conteudo: bytes) -> Relatorio:
    """Bytes de um .docx → modelo estruturado do relatório."""
    doc = docx.Document(BytesIO(conteudo))
    blocos = _blocos(doc)
    if not blocos:
        raise ValueError("O documento está vazio.")
    rel = _ler_executivo(blocos) if _parece_executivo(blocos) else _ler_completo(blocos)
    if not rel.secoes and not rel.setores:
        raise ValueError("Não foi possível identificar seções no documento.")
    return rel
