"""PDF do pedido: o próprio Formulário de Encaminhamento Geral, preenchido.

Escreve os dados sobre o PDF original (mesmo papel que a clínica conhece),
marca os exames nas caixas e troca a etiqueta pelo código de barras do
pedido. O que não tem lugar no papel (campos ou exames criados depois) vai
para uma página extra "Informações adicionais".
"""
from io import BytesIO
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from reportlab.graphics.barcode.code128 import Code128
from reportlab.lib.colors import HexColor, white
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

from .encaminhamento_campos import CODIGOS_RODAPE, ETIQUETA, PDF
from .encaminhamento_catalogo import POR_CODIGO, REVISAO

MODELO = Path(__file__).parent / "formularios" / "encaminhamento_geral_rev1.pdf"
TINTA = HexColor("#0b3d91")  # azul de caneta: o que foi preenchido salta do impresso
FONTE, FONTE_B = "Helvetica", "Helvetica-Bold"


def _cortar(texto: str, largura: float, tamanho: float) -> str:
    if stringWidth(texto, FONTE, tamanho) <= largura:
        return texto
    while texto and stringWidth(texto + "…", FONTE, tamanho) > largura:
        texto = texto[:-1]
    return texto + "…"


class _Folha:
    """Desenha em coordenadas "do topo", como foram medidas no PDF."""

    def __init__(self, c: canvas.Canvas, altura: float):
        self.c, self.h = c, altura

    def texto(self, x, topo, s, tamanho=8, largura=None, negrito=False):
        if largura:
            s = _cortar(s, largura, tamanho)
        self.c.setFont(FONTE_B if negrito else FONTE, tamanho)
        self.c.setFillColor(TINTA)
        self.c.drawString(x, self.h - topo - 7, s)

    def fim(self, x_final, topo, s, tamanho=8):
        self.c.setFont(FONTE, tamanho)
        self.c.setFillColor(TINTA)
        self.c.drawRightString(x_final, self.h - topo - 7, s)

    def xis(self, cx, topo):
        self.c.setFont(FONTE_B, 8.5)
        self.c.setFillColor(TINTA)
        self.c.drawCentredString(cx, self.h - topo - 7, "X")

    def caixa(self, x, topo, lado):
        m = lado * 0.18
        y0, y1 = self.h - topo - lado + m, self.h - topo - m
        self.c.setStrokeColor(TINTA)
        self.c.setLineWidth(1.1 if lado > 6 else 0.9)
        self.c.line(x + m, y0, x + lado - m, y1)
        self.c.line(x + m, y1, x + lado - m, y0)

    def grade(self, grade, s):
        topo, xs = grade
        s = s.upper()[: len(xs)]
        self.c.setFont(FONTE, 7.5)
        self.c.setFillColor(TINTA)
        for x, letra in zip(xs, s):
            self.c.drawCentredString(x + 5.65, self.h - topo - 8, letra)


def _desenhar_campo(f: _Folha, pos, valor, texto: str) -> None:
    tipo = pos[0]
    if tipo == "texto":
        if texto:
            f.texto(pos[1], pos[2], texto, largura=pos[3])
    elif tipo == "fim":
        if texto:
            f.fim(pos[1], pos[2], texto)
    elif tipo == "grade":
        if texto:
            f.grade(pos[1], texto)
    elif tipo == "x":
        if valor:
            f.xis(pos[1], pos[2])
    elif tipo == "opcao":
        alvo = pos[1].get(str(valor)) if valor not in (None, "") else None
        if alvo:
            _desenhar_campo(f, alvo, True, "")
    elif tipo == "caixa":
        if valor:
            f.caixa(pos[1], pos[2], pos[3])


def _etiqueta(f: _Folha, numero: int) -> None:
    x, topo, larg, alt = ETIQUETA
    c = f.c
    # Cobre o código de exemplo do impresso e põe o do pedido.
    c.setFillColor(white)
    c.rect(x + 2, f.h - topo - alt + 2, larg - 4, alt - 12, stroke=0, fill=1)
    c.setFillColor(HexColor("#000000"))
    cod = Code128(f"{numero:08d}", barHeight=28, barWidth=1.05, humanReadable=False)
    bx = x + (larg - cod.width) / 2
    cod.drawOn(c, bx, f.h - topo - alt + 14)
    c.setFillColor(HexColor("#1f2933"))
    c.setFont(FONTE_B, 8)
    c.drawCentredString(x + larg / 2, f.h - topo - alt + 5, f"PEDIDO Nº {numero:08d}")


def gerar_pdf(pedido: dict) -> bytes:
    """`pedido`: numero, campos (cópia [{chave, rotulo, valor, texto}]),
    exames (cópia [{codigo, nome}]), criado_em, criado_por, versao."""
    modelo = PdfReader(str(MODELO))
    pagina = modelo.pages[0]
    largura, altura = float(pagina.mediabox.width), float(pagina.mediabox.height)

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=(largura, altura))
    f = _Folha(c, altura)
    _etiqueta(f, pedido["numero"])

    extras_campos = []
    for campo in pedido.get("campos", []):
        valor, texto = campo.get("valor"), campo.get("texto") or ""
        if valor in (None, "", False):
            continue
        pos = PDF.get(campo["chave"])
        if pos:
            _desenhar_campo(f, pos, valor, texto)
        else:
            extras_campos.append((campo["rotulo"], texto))

    extras_exames = []
    rodape = list(CODIGOS_RODAPE)
    for ex in pedido.get("exames", []):
        papel = POR_CODIGO.get(ex["codigo"])
        if papel:
            x, topo, lado = papel["caixa"]
            f.caixa(x, topo, lado)
        elif rodape:
            rx, rtopo, rl, ra = rodape.pop(0)
            c.setFont(FONTE_B, 8)
            c.setFillColor(TINTA)
            c.drawCentredString(rx + rl / 2, altura - rtopo - ra + 4, ex["codigo"][:5])
            extras_exames.append(ex)  # também na lista, com o nome
        else:
            extras_exames.append(ex)

    c.setFont(FONTE, 6)
    c.setFillColor(HexColor("#5a6b7a"))
    rodape_txt = f"Pedido {pedido['numero']:08d} · gerado no Alchemypet Integrado em {pedido.get('criado_em', '')}"
    if pedido.get("criado_por"):
        rodape_txt += f" por {pedido['criado_por']}"
    c.drawString(44, 10, rodape_txt)
    c.showPage()

    # Página extra: o que não cabe no papel.
    tem_extra = bool(extras_campos or extras_exames)
    if tem_extra:
        y = altura - 60
        c.setFillColor(HexColor("#1e3a5f"))
        c.setFont(FONTE_B, 13)
        c.drawString(44, y, f"Informações adicionais — Pedido Nº {pedido['numero']:08d}")
        y -= 16
        c.setFont(FONTE, 8)
        c.setFillColor(HexColor("#5a6b7a"))
        c.drawString(44, y, f"Complemento do {REVISAO}: itens que não têm lugar no formulário impresso.")
        y -= 26

        def linha(rot, txt, negrito_rot=True):
            nonlocal y
            if y < 50:
                c.showPage()
                y = altura - 60
            c.setFont(FONTE_B if negrito_rot else FONTE, 9)
            c.setFillColor(HexColor("#1f2933"))
            c.drawString(44, y, rot)
            c.setFont(FONTE, 9)
            c.setFillColor(TINTA)
            c.drawString(230, y, _cortar(txt, 330, 9))
            y -= 15

        if extras_campos:
            c.setFont(FONTE_B, 10)
            c.setFillColor(HexColor("#1e3a5f"))
            c.drawString(44, y, "Campos")
            y -= 16
            for rot, txt in extras_campos:
                linha(rot, txt)
            y -= 10
        if extras_exames:
            c.setFont(FONTE_B, 10)
            c.setFillColor(HexColor("#1e3a5f"))
            c.drawString(44, y, "Exames solicitados fora do formulário impresso")
            y -= 16
            for ex in extras_exames:
                linha(ex["codigo"], ex.get("nome", ""))
        c.showPage()
    c.save()

    sobreposicao = PdfReader(BytesIO(buf.getvalue()))
    saida = PdfWriter()
    pagina.merge_page(sobreposicao.pages[0])
    saida.add_page(pagina)
    for extra in sobreposicao.pages[1:]:
        saida.add_page(extra)
    out = BytesIO()
    saida.write(out)
    return out.getvalue()
