"""PDF do pedido: o próprio Formulário de Encaminhamento Geral (4 páginas),
preenchido.

Desenha as páginas do impresso (imagens de alta resolução do PDF original,
bem mais leves que ele) e escreve por cima, em azul de caneta: os dados nos
campos, um X em cada exame pedido (em todos os blocos onde ele aparece) e o
código de barras do pedido na etiqueta. O que não tem lugar no papel (campos
ou exames criados depois) vai para uma página extra "Informações adicionais".
"""
from io import BytesIO
from pathlib import Path

from reportlab.graphics.barcode.code128 import Code128
from reportlab.lib.colors import HexColor, white
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

from .encaminhamento_campos import CODIGOS_RODAPE, ETIQUETA, PAGINA, PDF
from .encaminhamento_catalogo import POR_CODIGO, REVISAO

PASTA = Path(__file__).parent / "formularios" / "geral_4p"
PAGINAS = [PASTA / f"pagina-{i}.png" for i in range(1, 5)]
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

    def texto(self, x, topo, s, tamanho=8, largura=None):
        if largura:
            s = _cortar(s, largura, tamanho)
        self.c.setFont(FONTE, tamanho)
        self.c.setFillColor(TINTA)
        self.c.drawString(x, self.h - topo - 7, s)

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

    def linhas(self, x, topos, largura, s, x_primeira=None, tamanho=7):
        """Texto longo quebrado nas linhas do papel (a 1ª pode começar mais à direita)."""
        palavras = s.split()
        for i, topo in enumerate(topos):
            if not palavras:
                break
            x0 = x_primeira if (i == 0 and x_primeira) else x
            lim = largura - (x0 - x)
            linha = ""
            while palavras and stringWidth((linha + " " + palavras[0]).strip(), FONTE, tamanho) <= lim:
                linha = (linha + " " + palavras.pop(0)).strip()
            if not linha:  # palavra maior que a linha
                linha = palavras.pop(0)
            if i == len(topos) - 1 and palavras:
                linha = linha + " " + " ".join(palavras)
                palavras = []
            self.texto(x0, topo, linha, tamanho, lim)

    def ponto(self, x, topo):
        self.c.setFillColor(HexColor("#d0021b"))
        self.c.circle(x, self.h - topo, 2.6, stroke=0, fill=1)


def _desenhar(f: _Folha, pos, valor, texto: str) -> None:
    tipo = pos[0]
    if tipo == "texto":
        if texto:
            f.texto(pos[1], pos[2], texto, largura=pos[3])
    elif tipo == "grade":
        if texto:
            f.grade(pos[1], texto)
    elif tipo == "x":
        if valor:
            f.xis(pos[1], pos[2])
    elif tipo == "caixa":
        if valor:
            f.caixa(pos[1], pos[2], pos[3])
    elif tipo == "opcao":
        alvo = pos[1].get(str(valor)) if valor not in (None, "") else None
        if alvo:
            _desenhar(f, alvo, True, "")
    elif tipo == "multi":
        for v in valor if isinstance(valor, list) else []:
            if v in pos[1]:
                _desenhar(f, pos[1][v], True, "")
    elif tipo == "linhas":
        if texto:
            f.linhas(pos[1], pos[2], pos[3], texto, pos[4] if len(pos) > 4 else None)
    elif tipo == "diagrama":
        x0, t0, x1, t1 = pos[1:]
        for p in valor if isinstance(valor, list) else []:
            try:
                f.ponto(x0 + float(p["x"]) * (x1 - x0), t0 + float(p["y"]) * (t1 - t0))
            except (KeyError, TypeError, ValueError):
                continue


def _etiqueta(f: _Folha, numero: int) -> None:
    x, topo, larg, alt = ETIQUETA
    c = f.c
    # Cobre o código de exemplo do impresso e põe o do pedido.
    c.setFillColor(white)
    c.rect(x + 2, f.h - topo - alt + 2, larg - 4, alt - 12, stroke=0, fill=1)
    c.setFillColor(HexColor("#000000"))
    cod = Code128(f"{numero:08d}", barHeight=28, barWidth=1.05, humanReadable=False)
    cod.drawOn(c, x + (larg - cod.width) / 2, f.h - topo - alt + 14)
    c.setFillColor(HexColor("#1f2933"))
    c.setFont(FONTE_B, 8)
    c.drawCentredString(x + larg / 2, f.h - topo - alt + 5, f"PEDIDO Nº {numero:08d}")


def gerar_pdf(pedido: dict) -> bytes:
    """`pedido`: numero, campos (cópia [{chave, rotulo, valor, texto}]),
    exames (cópia [{codigo, nome}]), criado_em, criado_por, versao."""
    largura, altura = PAGINA
    # O que vai em cada página do impresso.
    por_pagina: dict[int, list] = {1: [], 2: [], 3: [], 4: []}
    extras_campos, extras_exames = [], []

    for campo in pedido.get("campos", []):
        valor, texto = campo.get("valor"), campo.get("texto") or ""
        if valor in (None, "", False, []):
            continue
        pos = PDF.get(campo["chave"])
        if pos:
            por_pagina[pos[0]].append(("campo", pos[1], valor, texto))
        else:
            extras_campos.append((campo["rotulo"], texto))

    rodape = list(CODIGOS_RODAPE)
    for ex in pedido.get("exames", []):
        papel = POR_CODIGO.get(ex["codigo"])
        if papel and papel.get("caixas"):
            for pagina, x, topo, lado in papel["caixas"]:
                por_pagina[pagina].append(("caixa", (x, topo, lado)))
        elif rodape:
            por_pagina[1].append(("rodape", rodape.pop(0), ex["codigo"]))
            extras_exames.append(ex)  # também na lista, com o nome
        else:
            extras_exames.append(ex)

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=(largura, altura))
    c.setTitle(f"Pedido {pedido['numero']:08d}")
    f = _Folha(c, altura)
    for n in (1, 2, 3, 4):
        c.drawImage(ImageReader(str(PAGINAS[n - 1])), 0, 0, width=largura, height=altura)
        if n == 1:
            _etiqueta(f, pedido["numero"])
        for item in por_pagina[n]:
            if item[0] == "campo":
                _desenhar(f, item[1], item[2], item[3])
            elif item[0] == "caixa":
                f.caixa(*item[1])
            else:
                rx, rtopo, rl, ra = item[1]
                c.setFont(FONTE_B, 8)
                c.setFillColor(TINTA)
                c.drawCentredString(rx + rl / 2, altura - rtopo - ra + 4, item[2][:6])
        c.setFont(FONTE, 6)
        c.setFillColor(HexColor("#5a6b7a"))
        rodape_txt = f"Pedido {pedido['numero']:08d} · página {n} de 4"
        if n == 1:
            rodape_txt += f" · gerado no Alchemypet Integrado em {pedido.get('criado_em', '')}"
            if pedido.get("criado_por"):
                rodape_txt += f" por {pedido['criado_por']}"
        c.drawString(40, 8, rodape_txt)
        c.showPage()

    # Página extra: o que não cabe no papel.
    if extras_campos or extras_exames:
        y = altura - 60
        c.setFillColor(HexColor("#1e3a5f"))
        c.setFont(FONTE_B, 13)
        c.drawString(44, y, f"Informações adicionais — Pedido Nº {pedido['numero']:08d}")
        y -= 16
        c.setFont(FONTE, 8)
        c.setFillColor(HexColor("#5a6b7a"))
        c.drawString(44, y, f"Complemento do {REVISAO}: itens que não têm lugar no formulário impresso.")
        y -= 26

        def linha(rot, txt):
            nonlocal y
            if y < 50:
                c.showPage()
                y = altura - 60
            c.setFont(FONTE_B, 9)
            c.setFillColor(HexColor("#1f2933"))
            c.drawString(44, y, _cortar(rot, 180, 9))
            c.setFont(FONTE, 9)
            c.setFillColor(TINTA)
            c.drawString(230, y, _cortar(txt, 380, 9))
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
    return buf.getvalue()
