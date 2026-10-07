"""Modelo estruturado → PDF diagramado (WeasyPrint).

Monta o HTML do relatório e imprime em A4 com a identidade do modelo
aprovado pela Diretoria. As fontes ficam em `fonts/` ao lado deste módulo.
"""
from __future__ import annotations

import re
from html import escape
from pathlib import Path

from .modelo import (
    Destaque,
    GradeMeses,
    Lista,
    Paragrafo,
    Relatorio,
    Secao,
    Setor,
    SubTitulo,
    Tabela,
)
from .template import CSS

_BASE = Path(__file__).resolve().parent
_ROMANOS = ("I", "II", "III", "IV", "V", "VI")


def _e(texto: str) -> str:
    """Escapa o texto e marca **negrito** vindo do Word como <strong>."""
    out = escape(texto or "")
    return re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", out)


def _e_linhas(texto: str) -> str:
    """Como `_e`, mas preserva as quebras de linha da célula do Word."""
    partes = [p.strip() for p in re.split(r"[\r\n]+", texto or "") if p.strip()]
    return "<br>".join(_e(p) for p in partes)


def _n2(i: int) -> str:
    return f"{i:02d}"


# ----------------------------------------------------------------------
#  Blocos
# ----------------------------------------------------------------------
def _html_lista(b: Lista) -> str:
    cls = "pontos colunas" if b.colunas > 1 else "pontos"
    itens = "".join(f"<li>{_e(i)}</li>" for i in b.itens)
    return f'<ul class="{cls}">{itens}</ul>'


def _html_tabela(b: Tabela) -> str:
    if not b.cabecalho and not b.linhas:
        return ""
    cls = "dados compacta" if b.compacta else "dados"
    cab = "".join(f"<th>{_e(c)}</th>" for c in b.cabecalho)
    corpo = "".join(
        "<tr>" + "".join(f"<td>{_e(c)}</td>" for c in linha) + "</tr>" for linha in b.linhas
    )
    return f'<table class="{cls}"><thead><tr>{cab}</tr></thead><tbody>{corpo}</tbody></table>'


def _html_meses(b: GradeMeses) -> str:
    cartoes = "".join(
        f'<div class="mes"><div class="cab"><span>{_e(c.mes.upper())}</span>'
        f'<span class="q">{len(c.itens)}</span></div>'
        f'<ul>{"".join(f"<li>{_e(i)}</li>" for i in c.itens)}</ul></div>'
        for c in b.cartoes
    )
    return f'<div class="meses">{cartoes}</div>'


def _html_destaque(b: Destaque) -> str:
    interno = "".join(_html_bloco(x) for x in b.blocos)
    tom = " ouro" if b.tom == "ouro" else ""
    rot = f'<div class="rot">{_e(b.titulo.upper())}</div>' if b.titulo else ""
    return f'<div class="destaque{tom}">{rot}{interno}</div>'


def _html_bloco(b) -> str:
    if isinstance(b, Paragrafo):
        cls = ' class="centro"' if b.destaque else ""
        return f"<p{cls}>{_e(b.texto)}</p>"
    if isinstance(b, SubTitulo):
        return f'<h3 class="sub">{_e(b.texto)}</h3>'
    if isinstance(b, Lista):
        return _html_lista(b)
    if isinstance(b, Tabela):
        return _html_tabela(b)
    if isinstance(b, GradeMeses):
        return _html_meses(b)
    if isinstance(b, Destaque):
        return _html_destaque(b)
    return ""


# ----------------------------------------------------------------------
#  Partes do documento
# ----------------------------------------------------------------------
def _html_capa(rel: Relatorio) -> str:
    linhas = [
        ("DOCUMENTO", rel.documento or "Relatório Gerencial de Qualidade"),
        ("SETORES CONTEMPLADOS", rel.setores_contemplados),
        ("DESTINATÁRIO", rel.destinatario),
    ]
    corpo = "".join(
        f'<tr><td class="rot">{_e(r)}</td><td>{_e(v)}</td></tr>' for r, v in linhas if v
    )
    if rel.situacao_geral:
        corpo += (
            '<tr><td class="rot">SITUAÇÃO GERAL</td>'
            f'<td><span class="selo">{_e(rel.situacao_geral)}</span></td></tr>'
        )
    periodo = (
        '<div class="capa-periodo"><div class="rot">PERÍODO AVALIADO</div>'
        f'<div class="val">{_e(rel.periodo)}</div></div>'
        if rel.periodo
        else ""
    )
    lead = f'<div class="capa-lead">{_e(rel.resumo)}</div>' if rel.resumo else ""
    return f"""
<section class="capa">
  <div class="capa-top">
    <div class="capa-regua"></div>
    <div class="capa-chapeu">{_e(rel.chapeu)}</div>
    <h1>{_e(rel.titulo)}<br>{_e(rel.subtitulo)}</h1>
    {lead}
    {periodo}
  </div>
  <div class="capa-base"><table class="capa-meta">{corpo}</table></div>
  <div class="capa-rodape">Documento de uso interno · Elaborado pela Gestão da Qualidade</div>
</section>"""


def _html_sumario(rel: Relatorio) -> str:
    if len(rel.secoes) < 6:
        return ""
    partes: list[str] = []
    n = 0
    for parte, secoes in rel.partes:
        if parte:
            partes.append(f'<div class="sum-parte">{_e(parte)}</div>')
        linhas = []
        for s in secoes:
            n += 1
            linhas.append(
                f'<tr><td class="n">{_n2(n)}</td><td>{_e(s.titulo)}</td></tr>'
            )
        partes.append(f'<table class="sumario">{"".join(linhas)}</table>')
    return (
        '<section class="quebra"><h2 class="secao">'
        '<span class="num">—</span>Sumário</h2>' + "".join(partes) + "</section>"
    )


def _html_matriz(setores: list[Setor]) -> str:
    if not setores:
        return ""
    rotulos: list[str] = []
    for s in setores:
        for i in s.itens:
            if i.rotulo not in rotulos:
                rotulos.append(i.rotulo)
    if not rotulos:
        return ""
    cab = "".join(f"<th>{_e(r.upper())}</th>" for r in rotulos)
    linhas = []
    for s in setores:
        por_rotulo = {i.rotulo: i for i in s.itens}
        celulas = "".join(
            f'<td><span class="bola {por_rotulo[r].situacao}"></span></td>'
            if r in por_rotulo
            else "<td>—</td>"
            for r in rotulos
        )
        linhas.append(f"<tr><td>{_e(s.nome)}</td>{celulas}</tr>")
    return f"""
<h3 class="sub">Matriz consolidada de status</h3>
<table class="matriz"><thead><tr><th>SETOR</th>{cab}</tr></thead>
<tbody>{"".join(linhas)}</tbody></table>
<div class="legenda">
  <span class="it"><span class="bola ok"></span>Conforme / Em acompanhamento</span>
  <span class="it"><span class="bola atencao"></span>Requer atenção — detalhamento no item correspondente</span>
</div>"""


def _html_setor(i: int, s: Setor) -> str:
    linhas = []
    for item in s.itens:
        tag = '<span class="tag">ATENÇÃO</span>' if item.situacao == "atencao" else ""
        linhas.append(
            f'<tr><td class="rot">{_e(item.rotulo)}</td>'
            f"<td>{tag}{_e_linhas(item.texto)}</td></tr>"
        )
    plano = ""
    if s.plano:
        itens = "".join(f"<li>{_e(p)}</li>" for p in s.plano)
        plano = (
            '<div class="plano"><div class="rot">PLANO DE MELHORIA</div>'
            f'<ul class="pontos">{itens}</ul></div>'
        )
    return f"""
<div class="setor">
  <div class="setor-head"><div class="n">SETOR {_n2(i)}</div><h3>{_e(s.nome)}</h3></div>
  <table class="itens">{"".join(linhas)}</table>
  {plano}
</div>"""


def _html_secao(n: int, s: Secao) -> str:
    corpo = "".join(_html_bloco(b) for b in s.blocos)
    return (
        f'<h2 class="secao"><span class="num">{_n2(n)}</span>{_e(s.titulo)}</h2>{corpo}'
    )


def _html_divisor(indice: int, titulo: str, descricao: str) -> str:
    rom = _ROMANOS[indice] if indice < len(_ROMANOS) else str(indice + 1)
    desc = f"<p>{_e(descricao)}</p>" if descricao else ""
    return (
        f'<section class="divisor"><div class="rom">{rom}</div>'
        f"<h2>{_e(titulo)}</h2>{desc}</section>"
    )


def _corpo_executivo(rel: Relatorio) -> str:
    partes: list[str] = []
    n = 0
    pend = sum(1 for s in rel.setores if s.tem_atencao)
    usou_matriz = False
    for secao in rel.secoes:
        n += 1
        partes.append(f'<h2 class="secao"><span class="num">{_n2(n)}</span>{_e(secao.titulo)}</h2>')
        if not usou_matriz and "painel" in secao.titulo.lower():
            partes.append(
                '<div class="kpis">'
                f'<div class="kpi"><div class="val">{len(rel.setores)}</div>'
                '<div class="rot">SETORES AVALIADOS</div></div>'
                f'<div class="kpi"><div class="val texto">{_e(rel.periodo)}</div>'
                '<div class="rot">PERÍODO AVALIADO</div></div>'
                f'<div class="kpi"><div class="val">{pend}</div>'
                '<div class="rot">SETORES COM PONTO DE ATENÇÃO</div></div>'
                "</div>"
            )
            partes.extend(_html_bloco(b) for b in secao.blocos)
            partes.append(_html_matriz(rel.setores))
            usou_matriz = True
            continue
        partes.extend(_html_bloco(b) for b in secao.blocos)
        if "setor" in secao.titulo.lower() and rel.setores:
            partes.extend(_html_setor(i, s) for i, s in enumerate(rel.setores, 1))
    if not usou_matriz and rel.setores:
        partes.insert(0, _html_matriz(rel.setores))
    return "".join(partes)


def _corpo_completo(rel: Relatorio) -> str:
    partes: list[str] = []
    n = 0
    divisores = 0
    parte_anterior = None
    for secao in rel.secoes:
        if secao.parte != parte_anterior and secao.parte:
            titulo = secao.parte.split("·", 1)[-1].strip()
            partes.append(_html_divisor(divisores, _titulo_parte(titulo), ""))
            divisores += 1
            parte_anterior = secao.parte
        n += 1
        partes.append(_html_secao(n, secao))
    return "".join(partes)


def _titulo_parte(t: str) -> str:
    t = t.strip()
    return t if t and t != t.upper() else t.title()


def montar_html(rel: Relatorio) -> str:
    corpo = _corpo_executivo(rel) if rel.tipo == "executivo" else _corpo_completo(rel)
    marca = f"Relatório Gerencial de Qualidade · {rel.periodo}" if rel.periodo else "Relatório Gerencial de Qualidade"
    return f"""<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>{_e(rel.titulo)}</title></head><body>
<div class="rodape-marca">{_e(marca)}</div>
{_html_capa(rel)}
<section class="quebra">{_html_sumario(rel)}{corpo}</section>
</body></html>"""


def gerar_pdf(rel: Relatorio) -> tuple[bytes, int]:
    """Modelo → (bytes do PDF final, número de páginas)."""
    from weasyprint import CSS as WeasyCSS, HTML  # import tardio: carga pesada

    base = str(_BASE) + "/"
    documento = HTML(string=montar_html(rel), base_url=base).render(
        stylesheets=[WeasyCSS(string=CSS, base_url=base)]
    )
    return documento.write_pdf(), len(documento.pages)
