"""Campos do Formulário de Encaminhamento Geral, na ordem do papel.

São a carga inicial da tabela `campo_encaminhamento`: depois disso a equipe
mantém os campos pela tela de configuração. `PDF` diz onde cada campo do
papel é escrito no formulário original; campos criados depois vão para a
página "Informações adicionais" do PDF.
"""

# Campos do rev. 1 que não existem no impresso atual: desativados uma vez
# (a equipe pode reativar na tela de configuração).
FORA_DO_IMPRESSO = ("categoria_plano", "guia_recoleta", "guia_material")
# Impresso de 4 páginas (o atual): volta Categoria do plano e os "Nº guia"; sai o ID.
VOLTAM_NO_IMPRESSO_4P = ("categoria_plano", "guia_recoleta", "guia_material")
SAEM_NO_IMPRESSO_4P = ("paciente_id",)

# Seção "Histologia e Citologia": vale quando o pedido tem exame destes grupos.
_HISTO = "grupo:citologia|histopatologia|imuno"

_SIM_NAO = [{"valor": "nao", "rotulo": "Não"}, {"valor": "sim", "rotulo": "Sim"}]


def _c(chave, rotulo, secao, tipo="texto", obrigatorio=False, largura=1, opcoes=None,
       mostrar_se="", ajuda=""):
    return {"chave": chave, "rotulo": rotulo, "secao": secao, "tipo": tipo,
            "obrigatorio": obrigatorio, "largura": largura, "opcoes": opcoes or [],
            "mostrar_se": mostrar_se, "ajuda": ajuda}


CAMPOS = [
    # Informações para emissão de laudos
    _c("clinica", "Clínica / Particular", "laudo", "clinica", True, 2,
       ajuda="Digite para buscar no cadastro de clínicas"),
    _c("data_coleta", "Data da coleta", "laudo", "data", True, 2),
    _c("veterinario", "Médico veterinário solicitante", "laudo", "texto", True, 2),
    _c("crmv", "CRMV", "laudo", "texto", True, 2),
    _c("responsavel", "Nome completo do responsável", "laudo", "texto", True, 2),
    _c("cpf", "CPF", "laudo", "texto", False, 2),
    _c("paciente", "Nome do paciente", "laudo", "texto", True, 1),
    _c("paciente_id", "ID", "laudo", "texto", False, 4),
    _c("plano_saude", "Plano de saúde", "laudo", "texto", False, 2),
    _c("matricula", "Matrícula", "laudo", "texto", False, 2),
    _c("categoria_plano", "Categoria do plano", "laudo", "texto", False, 1),
    _c("especie", "Espécie", "laudo", "opcao", True, 2, [
        {"valor": "canino", "rotulo": "Canino"}, {"valor": "felino", "rotulo": "Felino"},
        {"valor": "outros", "rotulo": "Outros"}]),
    _c("especie_outro", "Qual espécie?", "laudo", "texto", True, 2, mostrar_se="especie=outros"),
    _c("genero", "Gênero", "laudo", "opcao", True, 4, [
        {"valor": "m", "rotulo": "M"}, {"valor": "f", "rotulo": "F"}]),
    _c("raca", "Raça", "laudo", "texto", True, 4),
    _c("idade_anos", "Idade (anos)", "laudo", "numero", True, 4),
    _c("idade_meses", "Idade (meses)", "laudo", "numero", False, 4),
    _c("recoleta", "Recoleta", "laudo", "marcar", False, 4),
    _c("guia_recoleta", "Nº guia (recoleta)", "laudo", "texto", False, 4, mostrar_se="recoleta"),
    _c("material_faltante", "Material faltante", "laudo", "marcar", False, 4),
    _c("guia_material", "Nº guia (material faltante)", "laudo", "texto", False, 4,
       mostrar_se="material_faltante"),
    _c("fast_track", "Fast Track", "laudo", "marcar", False, 4),
    _c("exame_urgente", "Exame urgente", "laudo", "marcar", False, 4),
    # Motivo da solicitação
    _c("motivo", "Motivo da solicitação", "motivo", "opcao", True, 1, [
        {"valor": "preventivo", "rotulo": "Preventivo"},
        {"valor": "pre_tratamento", "rotulo": "Pré-Tratamento"},
        {"valor": "tratamento", "rotulo": "Tratamento"},
        {"valor": "pos_tratamento", "rotulo": "Pós-Tratamento"},
        {"valor": "paliativo", "rotulo": "Paliativo"}]),
    _c("suspeita", "Suspeita clínica / Observações", "motivo", "texto_longo", False, 1),
    _c("uso_medicamento", "Uso de medicamento", "motivo", "opcao", False, 2, _SIM_NAO),
    _c("medicamentos", "Qual(is)?", "motivo", "texto", False, 2, mostrar_se="uso_medicamento=sim"),
    # Histologia e Citologia (página 2 do impresso). Aparece quando há exame
    # de citologia, histopatologia ou imuno-histoquímica no pedido.
    _c("material_tipo", "Material enviado para exame", "histo", "multipla", False, 1, [
        {"valor": "peca_cirurgica", "rotulo": "Peça Cirúrgica"},
        {"valor": "puncao_agulha", "rotulo": "Punção por Agulha"},
        {"valor": "biopsia_pele", "rotulo": "Biópsia de Pele"},
        {"valor": "fragmentos_orgaos", "rotulo": "Fragmentos de Órgãos"}], mostrar_se=_HISTO),
    _c("material_peca", "Peça Cirúrgica", "histo", "texto", False, 2, mostrar_se=_HISTO),
    _c("material_fragmentos", "Fragmentos de Órgãos", "histo", "texto", False, 2, mostrar_se=_HISTO),
    _c("material_obs", "Descrição do material", "histo", "texto_longo", False, 1, mostrar_se=_HISTO),
    _c("neoplasia_biopsia", "Para neoplasias", "histo", "opcao", False, 1, [
        {"valor": "excisional", "rotulo": "Biópsia Excisional"},
        {"valor": "incisional", "rotulo": "Biópsia Incisional"}], mostrar_se=_HISTO),
    _c("localizacao", "Localização / Órgão", "histo", "texto", True, 1, mostrar_se=_HISTO,
       ajuda="Para neoplasias cutâneas ou ósseas, marque também no esquema abaixo"),
    _c("caracteristicas", "Características da lesão", "histo", "multipla", False, 1, [
        {"valor": "aderida", "rotulo": "Aderida a Planos Profundos"},
        {"valor": "nao_aderida", "rotulo": "Não Aderida"},
        {"valor": "pedunculada", "rotulo": "Pedunculada"},
        {"valor": "sessil", "rotulo": "Séssil"},
        {"valor": "ulcerada", "rotulo": "Ulcerada"},
        {"valor": "nao_ulcerada", "rotulo": "Não Ulcerada"},
        {"valor": "firme", "rotulo": "Firme"},
        {"valor": "macia", "rotulo": "Macia"},
        {"valor": "friavel", "rotulo": "Friável"}], mostrar_se=_HISTO),
    _c("tamanho_1", "Tamanho (cm) — 1ª medida", "histo", "numero", False, 4, mostrar_se=_HISTO),
    _c("tamanho_2", "Tamanho (cm) — 2ª medida", "histo", "numero", False, 4, mostrar_se=_HISTO),
    _c("tamanho_3", "Tamanho (cm) — 3ª medida", "histo", "numero", False, 4, mostrar_se=_HISTO),
    _c("evolucao", "Evolução (tempo decorrido desde que foi notada)", "histo", "texto", False, 1,
       mostrar_se=_HISTO),
    _c("historico", "Histórico", "histo", "texto_longo", False, 1, mostrar_se=_HISTO,
       ajuda="Sinais clínicos, evolução, tratamento e resposta, contactantes se necessário, "
             "neoplasias diagnosticadas anteriormente, histórico familiar de neoplasias etc."),
    _c("suspeita_histo", "Suspeita clínica", "histo", "texto_longo", False, 1, mostrar_se=_HISTO),
    _c("lesoes_primarias", "Lesões primárias", "histo", "multipla", False, 1, [
        {"valor": v, "rotulo": r} for v, r in (
            ("macula", "Mácula"), ("bolha", "Bolha"), ("mancha", "Mancha"), ("urticaria", "Urticária"),
            ("papula", "Pápula"), ("nodulo", "Nódulo"), ("vesicula", "Vesícula"), ("tumor", "Tumor"))],
       mostrar_se=_HISTO),
    _c("outras_lesoes", "Outras lesões", "histo", "multipla", False, 1, [
        {"valor": v, "rotulo": r} for v, r in (
            ("escama", "Escama"), ("cisto", "Cisto"), ("colarete", "Colarete"), ("abscesso", "Abscesso"),
            ("cicatriz", "Cicatriz"), ("hiperpigmentacao", "Hiperpigmentação"), ("ulcera", "Úlcera"),
            ("eritema", "Eritema"), ("erosao", "Erosão"), ("calo", "Calo"), ("crosta", "Crosta"),
            ("alopecia", "Alopecia"), ("escoriacao", "Escoriação"), ("hiperqueratose", "Hiperqueratose"),
            ("fissura", "Fissura"), ("comedo", "Comedo"), ("hipotricose", "Hipotricose"),
            ("descamacao", "Descamação"))], mostrar_se=_HISTO),
    _c("pelagem", "Pelagem", "histo", "multipla", False, 1, [
        {"valor": "seca", "rotulo": "Seca"}, {"valor": "quebradica", "rotulo": "Quebradiça"},
        {"valor": "fosca", "rotulo": "Fosca"}, {"valor": "oleosa", "rotulo": "Oleosa"}], mostrar_se=_HISTO),
    _c("distribuicao_lesoes", "Distribuição das lesões", "histo", "diagrama", False, 1, mostrar_se=_HISTO,
       ajuda="Toque no desenho para marcar onde estão as lesões"),
    # Parasitológico 213 (3 amostras): data/hora de cada coleta.
    _c("amostra_1", "1ª amostra", "parasito", "texto", False, 3, mostrar_se="exame:213"),
    _c("amostra_2", "2ª amostra", "parasito", "texto", False, 3, mostrar_se="exame:213"),
    _c("amostra_3", "3ª amostra", "parasito", "texto", False, 3, mostrar_se="exame:213"),
    # Para uso do laboratório (preenchido na triagem)
    _c("data_chegada", "Data de chegada", "laboratorio", "data", False, 3),
    _c("n_amostras", "Nº de amostras", "laboratorio", "numero", False, 3),
    _c("recebido_por", "Recebido por", "laboratorio", "texto", False, 3),
]

# ------------------------------------------------------------------ PDF
# Posições no impresso de 4 páginas (pt, origem no topo da página).
#   ("texto", x, topo, largura_max)   ("grade", grade)   ("x", centro_x, topo)
#   ("caixa", x, topo, lado)          ("opcao"/"multi", {valor: posição})
#   ("linhas", x, [topos], largura)   texto longo quebrado nas linhas do papel
#   ("diagrama", x0, topo0, x1, topo1) desenho de distribuição das lesões
# Cada campo: (página, posição). Campos sem posição vão para a página extra.
PAGINA = (661.276, 907.89)

GRADE_RESPONSAVEL = (181.1, [round(204.5 + i * 11.333, 1) for i in range(27)])
GRADE_PACIENTE = (196.2, [round(147.0 + i * 11.333, 1) for i in range(40)])


def _x2(a, b, topo):
    """Centro de um "( )" do papel a partir das posições dos parênteses."""
    return ("x", round((a + b) / 2 + 1.2, 1), topo)


PDF = {
    # página 1 — Informações para emissão de laudos
    "clinica": (1, ("texto", 155, 151.3, 275)),
    "data_coleta": (1, ("texto", 507, 151.3, 92)),
    "veterinario": (1, ("texto", 204, 166.4, 220)),
    "crmv": (1, ("texto", 509, 167.8, 88)),
    "responsavel": (1, ("grade", GRADE_RESPONSAVEL)),
    "cpf": (1, ("texto", 533, 181.4, 66)),
    "paciente": (1, ("grade", GRADE_PACIENTE)),
    "plano_saude": (1, ("texto", 137, 210.8, 210)),
    "matricula": (1, ("texto", 405, 210.8, 194)),
    "categoria_plano": (1, ("texto", 156, 225.4, 444)),
    "especie": (1, ("opcao", {"canino": ("caixa", 145.7, 242.5, 8.5),
                              "felino": ("caixa", 313.2, 242.5, 8.5),
                              "outros": _x2(186.6, 197.4, 242.6)})),
    "especie_outro": (1, ("texto", 209, 241.0, 58)),
    "genero": (1, ("opcao", {"m": _x2(376.8, 387.5, 242.6), "f": _x2(402.9, 413.7, 242.6)})),
    "raca": (1, ("texto", 450, 241.0, 54)),
    "idade_anos": (1, ("texto", 541, 241.0, 20)),
    "idade_meses": (1, ("texto", 573, 241.0, 17)),
    "recoleta": (1, _x2(110.0, 120.8, 257.6)),
    "guia_recoleta": (1, ("texto", 166, 256.1, 57)),
    "material_faltante": (1, _x2(311.0, 321.8, 257.6)),
    "guia_material": (1, ("texto", 367, 256.1, 61)),
    "fast_track": (1, _x2(484.4, 495.1, 257.6)),
    "exame_urgente": (1, _x2(586.8, 597.6, 257.6)),
    # página 1 — Motivo da solicitação
    "motivo": (1, ("opcao", {"preventivo": _x2(105.4, 115.9, 288.4), "pre_tratamento": _x2(241.3, 251.8, 288.4),
                             "tratamento": _x2(353.6, 364.0, 288.4), "pos_tratamento": _x2(481.7, 492.2, 288.4),
                             "paliativo": _x2(585.9, 596.4, 288.4)})),
    "suspeita": (1, ("texto", 175, 301.4, 420)),
    "uso_medicamento": (1, ("opcao", {"nao": _x2(159.6, 172.1, 318.4), "sim": _x2(197.4, 210.0, 318.4)})),
    "medicamentos": (1, ("texto", 252, 317.7, 345)),
    # página 1 — Para uso do laboratório
    "data_chegada": (1, ("texto", 253, 121.0, 68)),
    "n_amostras": (1, ("texto", 386, 121.0, 74)),
    "recebido_por": (1, ("texto", 515, 121.0, 83)),
    # página 2 — Histologia e Citologia
    "material_tipo": (2, ("multi", {"peca_cirurgica": _x2(432.8, 439.1, 139.0),
                                    "puncao_agulha": _x2(432.8, 439.1, 157.0),
                                    "biopsia_pele": _x2(504.0, 510.3, 157.0),
                                    "fragmentos_orgaos": _x2(432.8, 440.7, 166.0)})),
    "material_peca": (2, ("texto", 507, 138.0, 92)),
    "material_fragmentos": (2, ("texto", 521, 165.0, 78)),
    "material_obs": (2, ("linhas", 433, [174.0, 183.0, 192.0], 166)),
    "neoplasia_biopsia": (2, ("opcao", {"excisional": _x2(432.8, 440.7, 212.1),
                                        "incisional": _x2(504.4, 512.2, 212.1)})),
    "localizacao": (2, ("texto", 488, 223.6, 111)),
    "caracteristicas": (2, ("multi", {v: _x2(432.8, 440.7, t) for v, t in (
        ("aderida", 244.1), ("nao_aderida", 253.1), ("pedunculada", 262.1), ("sessil", 271.1),
        ("ulcerada", 280.1), ("nao_ulcerada", 289.1), ("firme", 298.1), ("macia", 307.1),
        ("friavel", 316.1))})),
    "tamanho_1": (2, ("texto", 458, 321.5, 12)),
    "tamanho_2": (2, ("texto", 475, 321.5, 12)),
    "tamanho_3": (2, ("texto", 493, 321.5, 12)),
    "evolucao": (2, ("linhas", 433, [332.0, 341.0, 350.0], 166, 551)),
    "historico": (2, ("linhas", 433, [395.0, 404.0, 413.0, 422.0, 431.0, 440.0, 449.0], 166)),
    "suspeita_histo": (2, ("linhas", 433, [467.0, 476.0, 485.0], 166)),
    "lesoes_primarias": (2, ("multi", {v: _x2(a, a + 7.9, t) for v, a, t in (
        ("macula", 432.8, 528.3), ("bolha", 483.4, 528.3), ("mancha", 432.8, 537.3), ("urticaria", 483.5, 537.3),
        ("papula", 432.8, 546.3), ("nodulo", 483.4, 546.3), ("vesicula", 432.8, 555.3), ("tumor", 483.6, 555.3))})),
    "outras_lesoes": (2, ("multi", {v: _x2(a, a + 7.9, t) for v, a, t in (
        ("escama", 432.8, 578.3), ("cisto", 484.0, 578.3), ("colarete", 432.8, 587.3), ("abscesso", 483.4, 587.3),
        ("cicatriz", 432.8, 596.3), ("hiperpigmentacao", 483.7, 596.3), ("ulcera", 432.8, 605.3),
        ("eritema", 484.0, 605.3), ("erosao", 432.8, 614.3), ("calo", 483.6, 614.3), ("crosta", 432.8, 623.3),
        ("alopecia", 484.1, 623.3), ("escoriacao", 432.8, 632.3), ("hiperqueratose", 484.3, 632.3),
        ("fissura", 432.8, 641.3), ("comedo", 484.0, 641.3), ("hipotricose", 432.8, 650.3),
        ("descamacao", 484.8, 650.3))})),
    "pelagem": (2, ("multi", {"seca": _x2(432.8, 440.7, 673.3), "quebradica": _x2(467.1, 475.0, 673.3),
                              "fosca": _x2(519.2, 527.0, 673.3), "oleosa": _x2(555.8, 563.7, 673.3)})),
    "distribuicao_lesoes": (2, ("diagrama", 428.0, 704.0, 598.0, 850.0)),
    # página 3 — Parasitológico 213 (3 amostras)
    "amostra_1": (3, ("texto", 484, 508.5, 112)),
    "amostra_2": (3, ("texto", 484, 518.5, 112)),
    "amostra_3": (3, ("texto", 484, 530.0, 112)),
}

# "Se não achou seu exame, insira o código" (página 1): x, topo, largura, altura.
CODIGOS_RODAPE = [(436.7, 839.9, 24.5, 13.5), (465.7, 839.9, 24.5, 13.5), (494.9, 839.9, 24.5, 13.5)]
# Etiqueta de identificação do pedido (página 1): x, topo, largura, altura.
ETIQUETA = (452.0, 53.4, 148.1, 60.2)
