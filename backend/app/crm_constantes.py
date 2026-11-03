"""Listas fechadas do CRM (etapas do funil, temperatura, tipos de atividade)."""

# Ordem do funil. As duas últimas são saídas e exigem motivo.
ETAPAS: dict[str, str] = {
    "lead": "Lead",
    "distribuicao": "Distribuição",
    "contratos": "Contratos",
    "onboarding": "Onboarding",
    "cliente_ativo": "Cliente Ativo",
    "inativo": "Inativo",
    "bloqueado": "Bloqueado",
}
ETAPAS_SAIDA = {"inativo", "bloqueado"}

TEMPERATURAS: dict[str, str] = {"fria": "Fria", "morna": "Morna", "quente": "Quente"}

# Os mesmos tipos do Pocket, para a equipe reconhecer.
TIPOS_ATIVIDADE = [
    "Apresentação", "Cobrança", "Comentário", "E-mail", "Follow-Up", "Ligação",
    "Orçamento", "Pós Venda", "Proposta", "Reunião", "Suporte", "Visita", "Whatsapp",
]
# Registro automático do sistema (criação, mudança de etapa).
TIPO_SISTEMA = "Sistema"


def etapa_por_rotulo(texto: str) -> str | None:
    """Aceita a chave ou o rótulo do Pocket ("Cliente Ativo", "cliente ativo")."""
    import unicodedata

    t = unicodedata.normalize("NFKD", str(texto or "")).encode("ascii", "ignore").decode()
    t = t.strip().lower().replace(" ", "_")
    if t in ETAPAS:
        return t
    for chave, rotulo in ETAPAS.items():
        r = unicodedata.normalize("NFKD", rotulo).encode("ascii", "ignore").decode().lower().replace(" ", "_")
        if t == r:
            return chave
    return None
