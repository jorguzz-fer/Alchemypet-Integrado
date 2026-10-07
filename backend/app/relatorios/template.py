"""Folha de estilo do Relatório Gerencial de Qualidade (impressão A4).

Paleta e tipografia institucionais do modelo aprovado: Inter no texto,
Source Serif nos títulos, roxo #38214D com apoios em ouro #C7A02C.
"""

ROXO = "#38214D"
ROXO_MEDIO = "#5B3A7E"
ROXO_CLARO = "#F4F2F7"
OURO = "#C7A02C"
VERDE = "#2E9E70"
AMBAR = "#E0A82E"
TEXTO = "#2B2B33"
TEXTO_SUAVE = "#6B6B78"
LINHA = "#E4E2EA"

CSS = f"""
@font-face {{ font-family: 'Relato Sans'; src: url('fonts/Inter-Regular.woff2'); font-weight: 400; }}
@font-face {{ font-family: 'Relato Sans'; src: url('fonts/Inter-Medium.woff2'); font-weight: 500; }}
@font-face {{ font-family: 'Relato Sans'; src: url('fonts/Inter-SemiBold.woff2'); font-weight: 600; }}
@font-face {{ font-family: 'Relato Sans'; src: url('fonts/Inter-Bold.woff2'); font-weight: 700; }}
@font-face {{ font-family: 'Relato Serif'; src: url('fonts/SourceSerif4-Bold.woff2'); font-weight: 700; }}

@page {{
  size: A4;
  margin: 20mm 17mm 16mm;
  @bottom-left {{
    content: string(rodape);
    font-family: 'Relato Sans'; font-size: 7.5pt; color: {TEXTO_SUAVE};
  }}
  @bottom-right {{
    content: counter(page);
    font-family: 'Relato Sans'; font-size: 7.5pt; font-weight: 700; color: {ROXO_MEDIO};
  }}
}}
@page capa {{ margin: 0; @bottom-left {{ content: none; }} @bottom-right {{ content: none; }} }}

* {{ box-sizing: border-box; }}
body {{
  font-family: 'Relato Sans', sans-serif;
  font-size: 9.2pt; line-height: 1.55; color: {TEXTO}; margin: 0;
  hyphens: none;
}}
/* Hifenização só no texto corrido justificado; rótulos e títulos nunca quebram. */
p {{ margin: 0 0 7pt; text-align: justify; hyphens: auto; }}
h1, h2, h3, h4, th, td.rot, .rot, .capa-meta td.rot, .kpi .val, .sum-parte {{ hyphens: none; }}
strong {{ font-weight: 700; }}

/* ---------- Capa ---------- */
.capa {{ page: capa; height: 297mm; display: flex; flex-direction: column; }}
.capa-top {{
  background: linear-gradient(145deg, #2F1B44 0%, #46275F 45%, #553072 100%);
  color: #fff; padding: 42mm 20mm 0; height: 176mm;
}}
.capa-regua {{ width: 34mm; height: 2.6pt; background: {OURO}; margin-bottom: 11mm; }}
.capa-chapeu {{ font-size: 8pt; font-weight: 600; letter-spacing: .24em; color: #D8CCE6; }}
.capa h1 {{
  font-family: 'Relato Serif', serif; font-weight: 700; font-size: 31pt;
  line-height: 1.14; margin: 5mm 0 0; letter-spacing: -.01em;
}}
.capa-lead {{ margin-top: 6mm; font-size: 10.5pt; color: #E3D9ED; max-width: 118mm; line-height: 1.5; }}
.capa-periodo {{ margin-top: 26mm; border-left: 2.4pt solid {OURO}; padding-left: 5mm; }}
.capa-periodo .rot {{ font-size: 7.6pt; font-weight: 600; letter-spacing: .2em; color: #C9B9DA; }}
.capa-periodo .val {{ font-size: 15pt; font-weight: 700; margin-top: 1.5mm; }}
.capa-base {{ padding: 16mm 20mm 0; flex: 1; }}
.capa-meta {{ width: 100%; border-collapse: collapse; }}
.capa-meta td {{ padding: 3.6mm 0; border-bottom: .6pt solid {LINHA}; vertical-align: top; }}
.capa-meta td.rot {{
  width: 46mm; font-size: 7.4pt; font-weight: 600; letter-spacing: .1em;
  color: {TEXTO_SUAVE}; padding-right: 6mm;
}}
.capa-rodape {{ padding: 0 20mm 14mm; font-size: 8pt; color: {TEXTO_SUAVE}; }}
.selo {{
  display: inline-block; background: #E8F3EC; color: #1F6E4E; font-size: 7.6pt;
  font-weight: 700; letter-spacing: .1em; padding: 1.6mm 3.4mm; border-radius: 2pt;
}}

/* ---------- Estrutura ---------- */
.rodape-marca {{ string-set: rodape content(); position: absolute; visibility: hidden; }}
h2.secao {{
  font-family: 'Relato Serif', serif; font-size: 15pt; font-weight: 700; color: {ROXO};
  margin: 9mm 0 4mm; padding-bottom: 2.4mm; border-bottom: .8pt solid {LINHA};
  break-after: avoid;
}}
h2.secao .num {{ color: {OURO}; font-family: 'Relato Sans', sans-serif; font-size: 9.5pt; font-weight: 700; margin-right: 2.5mm; }}
h3.sub {{ font-size: 9.6pt; font-weight: 700; color: {ROXO_MEDIO}; margin: 6mm 0 2.5mm; break-after: avoid; }}
.divisor {{ page-break-before: always; padding-top: 52mm; }}
.divisor .rom {{ font-family: 'Relato Serif', serif; font-size: 44pt; color: {ROXO_CLARO}; line-height: .8; }}
.divisor h2 {{ font-family: 'Relato Serif', serif; font-size: 24pt; color: {ROXO}; margin: -14mm 0 0; }}
.divisor p {{ color: {TEXTO_SUAVE}; max-width: 120mm; margin-top: 4mm; }}
.quebra {{ page-break-before: always; }}

/* ---------- Sumário ---------- */
.sum-parte {{
  font-size: 7.6pt; font-weight: 700; letter-spacing: .13em; color: {ROXO_MEDIO};
  margin: 5mm 0 1.5mm;
}}
.sumario {{ width: 100%; border-collapse: collapse; }}
.sumario td {{ padding: 1.9mm 0; border-bottom: .5pt solid {LINHA}; font-size: 8.8pt; font-weight: 500; }}
.sumario td.n {{ width: 12mm; color: {OURO}; font-weight: 700; font-size: 8.4pt; }}

/* ---------- Painel executivo ---------- */
.kpis {{ display: flex; gap: 4mm; margin: 2mm 0 6mm; }}
.kpi {{ flex: 1; border: .6pt solid {LINHA}; border-top: 2.2pt solid {ROXO_MEDIO}; padding: 4mm; }}
.kpi .val {{ font-family: 'Relato Serif', serif; font-size: 20pt; color: {ROXO}; line-height: 1.05; }}
.kpi .val.texto {{ font-size: 13pt; }}
.kpi .rot {{ font-size: 7.2pt; font-weight: 600; letter-spacing: .12em; color: {TEXTO_SUAVE}; margin-top: 2.5mm; }}

table.matriz {{ width: 100%; border-collapse: collapse; margin-top: 2mm; }}
table.matriz th {{
  background: {ROXO}; color: #fff; font-size: 6.6pt; font-weight: 600; letter-spacing: .04em;
  padding: 3.2mm 1.6mm; text-align: center;
}}
table.matriz th:first-child {{ text-align: left; }}
table.matriz td {{ padding: 2.9mm 2.5mm; font-size: 8.6pt; text-align: center; border-bottom: .5pt solid {LINHA}; }}
table.matriz td:first-child {{ text-align: left; font-weight: 600; width: 38mm; }}
table.matriz tr:nth-child(even) td {{ background: #FAF8FC; }}
.bola {{ display: inline-block; width: 2.6mm; height: 2.6mm; border-radius: 50%; }}
.bola.ok {{ background: {VERDE}; }}
.bola.atencao {{ background: {AMBAR}; }}
.legenda {{ margin-top: 3mm; font-size: 7.8pt; color: {TEXTO_SUAVE}; }}
.legenda .bola {{ margin: 0 1.5mm 0 0; }}
.legenda span.it {{ margin-right: 7mm; }}

/* ---------- Cartões ---------- */
.cards {{ display: flex; flex-wrap: wrap; gap: 4mm; }}
.card {{
  width: calc(50% - 2mm); background: {ROXO_CLARO}; border-left: 2.2pt solid {OURO};
  padding: 3.6mm 4mm; break-inside: avoid;
}}
.card h4 {{ margin: 0 0 1.5mm; font-size: 9pt; color: {ROXO}; }}
.card p {{ margin: 0; font-size: 8.4pt; text-align: left; color: {TEXTO}; }}

/* ---------- Setor ---------- */
.setor {{ border: .6pt solid {LINHA}; border-top: 2.2pt solid {ROXO_MEDIO}; margin-bottom: 6mm; }}
.setor-head {{ padding: 4mm 5mm 3mm; border-bottom: .6pt solid {LINHA}; break-after: avoid; }}
.setor-head .n {{ font-size: 7.4pt; font-weight: 700; letter-spacing: .18em; color: {OURO}; }}
.setor-head h3 {{ font-family: 'Relato Serif', serif; font-size: 13pt; color: {ROXO}; margin: 1mm 0 0; }}
table.itens {{ width: 100%; border-collapse: collapse; }}
table.itens tr {{ break-inside: avoid; }}
table.itens td {{ padding: 2.8mm 5mm; border-bottom: .5pt solid {LINHA}; font-size: 8.6pt; vertical-align: top; }}
table.itens td.rot {{
  width: 44mm; font-size: 7.4pt; font-weight: 600; letter-spacing: .1em;
  color: {TEXTO_SUAVE}; text-transform: uppercase;
}}
.tag {{
  display: inline-block; background: #FBF1D8; color: #8A6410; font-size: 7pt; font-weight: 700;
  letter-spacing: .1em; padding: .9mm 2.2mm; border-radius: 2pt; margin-right: 2.5mm;
}}
.plano {{ background: #FAF7EF; border-left: 2.2pt solid {OURO}; margin: 4mm 5mm 5mm; padding: 3.6mm 4.5mm; break-inside: avoid; }}
.plano .rot {{ font-size: 7.6pt; font-weight: 700; letter-spacing: .16em; color: #8A6410; margin-bottom: 2mm; }}

/* ---------- Listas, tabelas e destaques ---------- */
ul.pontos {{ list-style: none; margin: 0 0 6pt; padding: 0; }}
ul.pontos li {{ position: relative; padding-left: 5mm; margin-bottom: 1.6mm; font-size: 8.8pt; }}
ul.pontos li::before {{
  content: ''; position: absolute; left: 1mm; top: 1.6mm;
  width: 1.9mm; height: 1.9mm; border-radius: 50%; background: {OURO};
}}
ul.colunas {{ columns: 3; column-gap: 8mm; }}
table.dados {{ width: 100%; border-collapse: collapse; margin: 2mm 0 5mm; font-size: 8.6pt; }}
table.dados th {{
  background: {ROXO}; color: #fff; font-size: 7.4pt; font-weight: 600; letter-spacing: .08em;
  padding: 2.8mm 2.5mm; text-align: left;
}}
table.dados td {{ padding: 2.5mm; border-bottom: .5pt solid {LINHA}; vertical-align: top; }}
table.dados tr:nth-child(even) td {{ background: #FAF8FC; }}
table.dados.compacta th, table.dados.compacta td {{ text-align: center; }}
table.dados.compacta th:first-child, table.dados.compacta td:first-child {{ text-align: left; font-weight: 600; }}
.destaque {{ background: {ROXO_CLARO}; border-left: 2.2pt solid {ROXO_MEDIO}; padding: 4mm 5mm; margin: 3mm 0 5mm; break-inside: avoid; }}
.destaque.ouro {{ background: #FAF7EF; border-left-color: {OURO}; }}
.destaque .rot {{ font-size: 7.6pt; font-weight: 700; letter-spacing: .16em; color: {ROXO_MEDIO}; margin-bottom: 2.5mm; }}
.destaque.ouro .rot {{ color: #8A6410; }}
.destaque p:last-child, .destaque ul:last-child {{ margin-bottom: 0; }}
.meses {{ display: flex; flex-wrap: wrap; gap: 3mm; margin: 2mm 0 5mm; }}
.mes {{ width: calc(25% - 2.25mm); border: .6pt solid {LINHA}; break-inside: avoid; }}
.mes .cab {{
  background: {ROXO_CLARO}; padding: 2.4mm 3mm; font-size: 7.6pt; font-weight: 700;
  letter-spacing: .14em; color: {ROXO_MEDIO}; display: flex; justify-content: space-between;
}}
.mes .cab .q {{ color: {TEXTO_SUAVE}; letter-spacing: 0; }}
.mes ul {{ list-style: none; margin: 0; padding: 2.6mm 3mm; font-size: 8.4pt; }}
.mes li {{ margin-bottom: 1.2mm; }}
.centro {{ text-align: center; font-weight: 700; color: {ROXO}; font-size: 10pt; margin: 3mm 0 4mm; }}
"""
