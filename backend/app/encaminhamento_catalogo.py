"""Exames do Formulário de Encaminhamento Geral (rev. 1), na ordem do papel.

A tela online e o PDF seguem esta lista: mesmos códigos, nomes, grupos e
tubos que o veterinário já conhece do formulário impresso.

`tubos`: bolinhas de cor do papel (amarelo, roxo, cinza).
`amostra`: siglas impressas ao lado do exame (SS, U, LE, FF…).
`selo`: NOVO / EXCLUSIVO, como no papel.
`destaque`: itens que o papel destaca com contorno vermelho.
`caixa`: posição da caixa de seleção no PDF original (x, topo, lado), em pt.
"""

REVISAO = "Formulário 13 rev. 1"

# Blocos na ordem do papel. `estilo` controla como a tela desenha o bloco.
GRUPOS = [
    {"id": "gold_pro", "titulo": "Perfil OneHealth Gold PRO", "estilo": "destaque"},
    {"id": "mais_utilizados", "titulo": "Exames mais utilizados clinicamente", "estilo": "cartoes"},
    {"id": "perfis_onehealth", "titulo": "Perfis OneHealth", "estilo": "perfis"},
    {"id": "diario", "titulo": "Perfil Diário Alchemypet", "estilo": "lista"},
    {"id": "fast_track", "titulo": "Perfil Fast Track Health", "estilo": "lista"},
    {"id": "renal", "titulo": "Perfil Renal Alchemypet", "estilo": "lista"},
]

A, R, C = "amarelo", "roxo", "cinza"


def _e(codigo, nome, grupo, caixa, descricao="", tubos=(), amostra="", selo="",
       destaque=False, marca="", inclui=()):
    return {
        "codigo": codigo, "nome": nome, "descricao": descricao, "grupo": grupo,
        "tubos": list(tubos), "amostra": amostra, "selo": selo, "destaque": destaque,
        "marca": marca, "inclui": list(inclui), "caixa": caixa,
    }


EXAMES = [
    _e("861", "Perfil OneHealth Gold PRO", "gold_pro", (173.4, 328.0, 8.5),
       "Hemograma, Glicose, Ureia, Creatinina, Bicarbonato, ALT, AST, Fosfatase Alcalina (FAL), "
       "Gama GT, Proteínas Totais e Frações (Albumina e Globulina), Colesterol Total e Frações "
       "(HDL, LDL e VLDL), Triglicérides, Frutosamina, β-hidroxibutirato (BHB), Ácidos Biliares, "
       "Lipase, Amilase, Bilirrubina Total e Frações (Direta e Indireta), Fósforo, Cálcio Total, "
       "Cloreto, Cálcio Iônico, Sódio, Potássio, Ferro, Ácido Úrico e Magnésio.",
       (A, R, C), selo="NOVO", marca="gold_pro"),

    _e("170", "Cultura Otológica de Bactérias Aeróbias e Antibiograma", "mais_utilizados",
       (49.4, 406.0, 8.5), "1 conduto", amostra="SS"),
    _e("171", "Cultura Otológica de Bactérias Aeróbias e Antibiograma", "mais_utilizados",
       (137.8, 406.0, 8.5), "2 condutos", amostra="SS"),
    _e("176", "Urina Tipo I com Urocultura e Antibiograma", "mais_utilizados",
       (226.1, 406.0, 8.5), amostra="U"),
    _e("711", "TrioDx® - Babesia, Ehrlichia e Anaplasma Teste Rápido", "mais_utilizados",
       (313.3, 405.2, 8.5), tubos=(A,), selo="EXCLUSIVO"),
    _e("977", "Titulação para Babesia spp e Ehrlichia spp - IgG ELISA", "mais_utilizados",
       (402.5, 406.2, 8.5), tubos=(A,)),
    _e("978", "FIV e FeLV por petPCR™ + teste rápido", "mais_utilizados",
       (491.1, 406.2, 8.5), tubos=(R, C)),

    _e("422", "Perfil OneHealth Gold", "perfis_onehealth", (135.7, 450.1, 8.5),
       tubos=(A, R, C), marca="gold", inclui=("Hematologia", "Bioquímica")),
    _e("533", "Perfil OneHealth Gold felino", "perfis_onehealth", (312.8, 450.1, 8.5),
       tubos=(A, R, C), marca="gold_felino", inclui=("Hematologia", "Bioquímica", "Função Pancreática")),
    _e("424", "Perfil OneHealth Prime", "perfis_onehealth", (490.5, 450.1, 8.5),
       tubos=(A, R, C), marca="prime", inclui=("Hematologia", "Bioquímica")),
    _e("307", "Perfil OneHealth Infinity", "perfis_onehealth", (132.7, 512.2, 8.5),
       tubos=(A, R, C), marca="infinity",
       inclui=("Hematologia", "Bioquímica", "Hormonal / Função Tireoidiana")),
    _e("531", "Perfil OneHealth Infinity felino", "perfis_onehealth", (309.8, 512.2, 8.5),
       tubos=(A, R, C), marca="infinity_felino",
       inclui=("Hematologia", "Bioquímica", "Hormonal / Função Tireoidiana", "Pancreática")),
    _e("423", "Perfil OneHealth Select", "perfis_onehealth", (487.5, 512.2, 8.5),
       tubos=(A, R, C), marca="select", inclui=("Hematologia", "Bioquímica")),

    # Perfil Diário Alchemypet — 1ª coluna
    _e("291", "Painel Alchemypet", "diario", (45.3, 586.0, 4.8),
       "Hemograma completo*, Ureia, Creatinina, ALT, FAL, AST e Albumina", (A, R)),
    _e("400", "Painel Alchemypet felino", "diario", (45.3, 604.9, 4.8),
       "Hemograma Completo*, Ureia, Creatinina, ALT e GGT", (A, R)),
    _e("292", "Painel Check-up 1", "diario", (45.3, 623.8, 4.8),
       "Hemograma Completo*, Ureia, Creatinina, ALT, FAL, GGT e Glicose", (A, R, C)),
    _e("293", "Painel Check-up 2", "diario", (45.3, 640.0, 4.8),
       "Hemograma Completo*, Ureia, Creatinina, ALT, FAL, GGT, Glicose e Urina Tipo I",
       (A, R, C), amostra="U"),
    _e("297", "Painel Eletrólitos", "diario", (45.3, 658.2, 4.8),
       "Sódio, Potássio, Cloreto, Cálcio Iônico, Magnésio e Fósforo", (A,)),
    _e("294", "Painel Geriátrico", "diario", (45.3, 676.2, 4.8),
       "Hemograma Completo*, Ureia, Creatinina, ALT, FAL, GGT, Glicose, T4 Total, Sódio, "
       "Potássio e Urina Tipo I", (A, R, C), amostra="U"),
    _e("295", "Painel Inflamatório canino", "diario", (45.3, 701.0, 4.8),
       "Hemograma Completo* e Proteína C Reativa canina", (A, R)),
    _e("296", "Painel Inflamatório felino", "diario", (45.3, 719.1, 4.8),
       "Hemograma Completo*, Alfa-1 Glicoproteína Ácida e Soro Amilóide A felino", (A, R)),
    _e("981", "Hemograma completo + Teste rápido TrioDx® - Babesia, Ehrlichia e Anaplasma",
       "diario", (45.3, 744.9, 4.8), tubos=(A, R), selo="NOVO", destaque=True),
    _e("546", "Perfil One Health Gold e Ácidos Biliares", "diario", (45.3, 764.5, 4.8),
       "2 determinações - 1 pré e 1 pós prandial", (A, R, C)),
    _e("543", "Perfil One Health Gold e Leishmania spp por petPCR™", "diario",
       (45.3, 785.4, 4.8), tubos=(A, R, C)),
    # Perfil Diário Alchemypet — 2ª coluna
    _e("544", "Perfil One Health Gold e Lipase Pancreática Específica canina", "diario",
       (225.6, 586.0, 4.8), tubos=(A, R, C)),
    _e("529", "Perfil One Health Gold e Lipase Pancreática Específica felina", "diario",
       (225.6, 602.7, 4.8), tubos=(A, R, C)),
    _e("540", "Perfil One Health Gold e SDMA", "diario", (225.6, 617.2, 4.8), tubos=(A, R, C)),
    _e("982", "Perfil One Health Gold e Teste rápido TrioDx® - Babesia, Ehrlichia e Anaplasma "
       "teste rápido", "diario", (225.6, 629.1, 4.8), tubos=(A, R, C), selo="NOVO", destaque=True),
    _e("541", "Perfil One Health Gold e SNAP® Combo FIV Anticorpo / FeLV Antígeno", "diario",
       (225.6, 652.3, 4.8), tubos=(A, R, C)),
    _e("548", "Perfil One Health Gold, T4 Total, T4 Livre e TSH", "diario",
       (225.6, 666.5, 4.8), tubos=(A, R, C)),

    # Perfil Fast Track Health — coluna do meio
    _e("725", "Babesia canis (Pesquisa de IgG -ELISA) com titulação", "fast_track",
       (225.6, 705.3, 4.8), tubos=(A,)),
    _e("717", "Babesia spp e Ehrlichia spp por petPCR™", "fast_track", (225.6, 720.4, 4.8), tubos=(R,)),
    _e("719", "Babesia spp por petPCR™", "fast_track", (225.6, 731.8, 4.8), tubos=(R,)),
    _e("716", "Babesia spp, Ehrlichia spp e Anaplasma spp por petPCR™", "fast_track",
       (225.6, 744.9, 4.8), tubos=(R,), destaque=True),
    _e("313", "Cinomose por petPCR™", "fast_track", (225.6, 764.3, 4.8),
       tubos=(R,), amostra="(pool) SE + U +"),
    _e("727", "Citologia Aspirativa", "fast_track", (225.6, 777.3, 4.8), tubos=(R,), amostra="ou TE ou LE"),
    _e("729", "Citologia de Líquido Cavitário", "fast_track", (225.6, 790.2, 4.8),
       "Pleural ou Peritoneal ou Pericárdico", (R,), amostra="ou TE ou LE"),
    # Perfil Fast Track Health — 3ª coluna
    _e("730", "Citologia de Pele", "fast_track", (407.3, 584.0, 4.8), amostra="LE ou R"),
    _e("731", "Citologia Otológica", "fast_track", (407.3, 599.1, 4.8), "1 Conduto Auditivo", amostra="LE"),
    _e("732", "Citologia Otológica", "fast_track", (407.3, 612.4, 4.8), "2 Condutos Auditivos", amostra="LE"),
    _e("728", "Coronavírus felino (FCoV) PIF por petPCR™", "fast_track", (407.3, 623.6, 4.8), tubos=(R,)),
    _e("726", "Ehrlichia canis (Pesquisa de IgG -ELISA) com titulação", "fast_track",
       (407.3, 636.5, 4.8), tubos=(A,), destaque=True),
    _e("718", "Ehrlichia spp por petPCR™", "fast_track", (407.3, 649.4, 4.8), tubos=(R,)),
    _e("722", "Giardia intestinalis por petPCR™", "fast_track", (407.3, 662.3, 4.8), amostra="FF"),
    _e("721", "Leishmaniose por petPCR™", "fast_track", (407.3, 675.4, 4.8), tubos=(R,)),
    _e("723", "Leptospirose por petPCR™", "fast_track", (407.3, 688.5, 4.8), tubos=(R,), amostra="e/ou U"),
    _e("724", "Parvovirose por petPCR™", "fast_track", (407.3, 701.7, 4.8), amostra="FF"),
    _e("720", "Vírus da Imunodeficiência felina (FIV) e Leucemia Viral felina (FeLV) por petPCR™",
       "fast_track", (407.3, 714.5, 4.8), tubos=(R,), destaque=True),

    # Perfil Renal Alchemypet
    _e("261", "Função Renal 1", "renal", (408.1, 751.7, 4.8), "Ureia e Creatinina", (A,), destaque=True),
    _e("262", "Função Renal 2", "renal", (408.1, 763.6, 4.8),
       "Ureia, Creatinina, Sódio, Potássio, Fósforo e Cálcio Iônico", (A,)),
    _e("263", "Função Renal 3", "renal", (408.1, 782.6, 4.8), "Ureia, Creatinina e SDMA™", (A,)),
    _e("264", "Função Renal 4", "renal", (408.1, 795.1, 4.8),
       "Hemograma Completo*, Ureia, Creatinina, SDMA e Urina Tipo I", (A, R), amostra="U"),
]

POR_CODIGO = {e["codigo"]: e for e in EXAMES}

# Legenda das siglas impressas no papel (mostrada como dica na tela).
SIGLAS = {
    "SS": "Swab estéril", "U": "Urina", "LE": "Lâmina (esfregaço)", "R": "Raspado",
    "FF": "Fezes frescas", "TE": "Tubo estéril", "SE": "Swab estéril",
}
TUBOS = {"amarelo": "Tubo de tampa amarela (soro)", "roxo": "Tubo de tampa roxa (EDTA)",
         "cinza": "Tubo de tampa cinza (fluoreto)"}

MOTIVOS = {
    "preventivo": "Preventivo", "pre_tratamento": "Pré-Tratamento", "tratamento": "Tratamento",
    "pos_tratamento": "Pós-Tratamento", "paliativo": "Paliativo",
}
