"""Campos do Formulário de Encaminhamento Geral, na ordem do papel.

São a carga inicial da tabela `campo_encaminhamento`: depois disso a equipe
mantém os campos pela tela de configuração. `PDF` diz onde cada campo do
papel é escrito no formulário original; campos criados depois vão para a
página "Informações adicionais" do PDF.
"""

# Campos do rev. 1 que não existem no impresso atual: desativados uma vez
# (a equipe pode reativar na tela de configuração).
FORA_DO_IMPRESSO = ("categoria_plano", "guia_recoleta", "guia_material")

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
    # Para uso do laboratório (preenchido na triagem)
    _c("data_chegada", "Data de chegada", "laboratorio", "data", False, 3),
    _c("n_amostras", "Nº de amostras", "laboratorio", "numero", False, 3),
    _c("recebido_por", "Recebido por", "laboratorio", "texto", False, 3),
]

# Grades de letras do papel (uma letra por quadrinho): x de cada quadrinho.
GRADE_RESPONSAVEL = (156.6, [180.0, 191.4, 202.7, 214.0, 225.4, 236.7, 248.1, 259.4, 270.7, 282.1, 293.4, 304.7, 316.1, 327.4, 338.8, 350.1, 361.4, 372.8, 384.1, 395.5, 406.8, 418.1, 429.5, 440.8, 452.1, 463.5, 474.8])
GRADE_PACIENTE = (171.7, [122.5, 133.8, 145.2, 156.5, 167.9, 179.2, 190.5, 201.9, 213.2, 224.5, 235.9, 247.2, 258.6, 269.9, 281.2, 292.6, 303.9, 315.3, 326.6, 337.9, 349.3, 360.6, 371.9, 383.3, 394.6, 406.0, 417.3, 428.6, 440.0, 451.3, 462.7, 474.0, 485.3, 496.7, 508.0, 519.3, 530.7, 542.0, 553.4, 564.7])

# Posições no PDF original (pt, origem no topo, como medidas no arquivo).
#   ("texto", x, topo, largura_max)   ("fim", x_final, topo)   ("grade", grade)
#   ("x", centro_x, topo)             ("caixa", x, topo, lado)
#   ("opcao", {valor: posição})
PDF = {
    "clinica": ("texto", 126, 128.6, 310),
    "data_coleta": ("texto", 480, 128.6, 95),
    "veterinario": ("texto", 176, 143.6, 265),
    "crmv": ("texto", 485, 143.6, 88),
    "responsavel": ("grade", GRADE_RESPONSAVEL),
    "cpf": ("texto", 507, 158.6, 75),
    "paciente": ("grade", GRADE_PACIENTE),
    "plano_saude": ("texto", 108, 188.6, 215),
    "matricula": ("texto", 376, 188.6, 200),
    "categoria_plano": ("texto", 127, 203.6, 450),
    "especie": ("opcao", {"canino": ("caixa", 121.2, 218.0, 8.5),
                          "felino": ("caixa", 288.7, 218.0, 8.5),
                          "outros": ("x", 167.2, 218.6)}),
    "especie_outro": ("texto", 178, 218.6, 72),
    "genero": ("opcao", {"m": ("x", 357.4, 218.6), "f": ("x", 383.5, 218.6)}),
    "raca": ("texto", 424, 218.6, 58),
    "idade_anos": ("fim", 537, 218.6),
    "idade_meses": ("fim", 566, 218.6),
    "recoleta": ("x", 91.3, 233.6),
    "guia_recoleta": ("texto", 140, 233.6, 100),
    "material_faltante": ("x", 292.6, 233.6),
    "guia_material": ("texto", 341, 233.6, 85),
    "fast_track": ("x", 466.2, 233.6),
    "exame_urgente": ("x", 568.4, 233.6),
    "motivo": ("opcao", {"preventivo": ("x", 86.9, 264.3), "pre_tratamento": ("x", 222.9, 264.3),
                         "tratamento": ("x", 335.0, 264.3), "pos_tratamento": ("x", 463.2, 264.3),
                         "paliativo": ("x", 567.5, 264.3)}),
    "suspeita": ("texto", 148, 279.3, 430),
    "uso_medicamento": ("opcao", {"nao": ("x", 142.3, 294.3), "sim": ("x", 180.2, 294.3)}),
    "medicamentos": ("texto", 225, 294.3, 350),
    "data_chegada": ("texto", 226, 98.1, 95),
    "n_amostras": ("texto", 358, 98.1, 110),
    "recebido_por": ("texto", 488, 98.1, 90),
}

# Rodapé "Se não achou seu exame, insira o código": três quadrinhos.
CODIGOS_RODAPE = [(412.2, 815.4, 24.5, 13.5), (441.2, 815.4, 24.5, 13.5), (470.4, 815.4, 24.5, 13.5)]
# Etiqueta de identificação do pedido (canto superior direito).
ETIQUETA = (427.5, 28.9, 148.1, 60.2)
