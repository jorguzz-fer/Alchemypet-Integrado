"""Classificação de chamados: complexidade (baixa/média/alta) e motivo.

Estratégia HÍBRIDA:
  1) regras determinísticas por palavra-chave (rápidas, sem custo);
  2) IA (Claude) como fallback quando a regra não tem certeza — habilitada
     quando ANTHROPIC_API_KEY estiver configurada (ligada na etapa da
     automação de e-mail). Sem a chave, opera só com regras.

Na importação da planilha os valores já vêm preenchidos e são apenas
normalizados; o classificador é usado para chamados novos (cadastro manual
e, adiante, ingestão do Gmail).
"""
import re
import unicodedata

COMPLEXIDADES = ("baixa", "media", "alta")

# Taxonomia canônica de motivos (a mesma da planilha de chamados).
MOTIVOS: tuple[str, ...] = (
    "Revisão de resultado",
    "Dúvida técnica - realização de exame",
    "Dúvida técnica - solicitação de exame",
    "Questionamento recoleta",
    "Prioridade liberação de resultado",
    "Extensão recoleta",
    "Cancelamento de exame",
    "Unificação de guias",
    "Pedido de insumos",
    "Agendamento de reunião técnica",
    "Atraso na liberação",
    "Uso de etiquetas logística",
    "Auditoria Petlove",
)

# Regras de motivo por palavra-chave (a primeira que casar vence).
_MOTIVO_REGRAS: list[tuple[str, str]] = [
    (r"revis[aã]o de resultado|revisar resultado|refazer|recheca", "Revisão de resultado"),
    (r"unifica[cç][aã]o de guia|unificar guia", "Unificação de guias"),
    (r"cancel", "Cancelamento de exame"),
    (r"extens[aã]o.*recoleta|estender recoleta", "Extensão recoleta"),
    (r"recoleta|reco[lh]eta", "Questionamento recoleta"),
    (r"priorida|urgent|libera[cç][aã]o de resultado|liberar resultado", "Prioridade liberação de resultado"),
    (r"atraso|demora|prazo estourado", "Atraso na liberação"),
    (r"insumo|tubo|kit|material", "Pedido de insumos"),
    (r"reuni[aã]o", "Agendamento de reunião técnica"),
    (r"etiqueta|log[ií]stica", "Uso de etiquetas logística"),
    (r"auditoria|petlove", "Auditoria Petlove"),
    (r"solicita[cç][aã]o de exame|solicitar exame|como pedir|qual exame pedir", "Dúvida técnica - solicitação de exame"),
    (r"realiza[cç][aã]o de exame|d[uú]vida t[eé]cnica|interpreta|como funciona|metodologia", "Dúvida técnica - realização de exame"),
]

_ALTA = r"urgent|priorida|imediat|atraso|reclama|insatisfa|erro grave|cr[ií]tico|auditoria"
_BAIXA = r"agradec|obrigad|confirma[cç][aã]o|ok\b|ci[eê]nte|informa[cç][aã]o simples"


def _key(s: str) -> str:
    s = "".join(c for c in unicodedata.normalize("NFD", str(s or "")) if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).strip().lower()


def normalizar_complexidade(v: str) -> str:
    k = _key(v)
    if k.startswith("baix"):
        return "baixa"
    if k.startswith("med") or k.startswith("méd"):
        return "media"
    if k.startswith("alt"):
        return "alta"
    return ""


def normalizar_motivo(v: str) -> str:
    """Mapeia um texto livre para o motivo canônico mais próximo."""
    k = _key(v)
    if not k:
        return ""
    for canon in MOTIVOS:
        if _key(canon) == k:
            return canon
    # tenta pelas regras de palavra-chave
    for padrao, canon in _MOTIVO_REGRAS:
        if re.search(padrao, k):
            return canon
    return v.strip()  # mantém o texto original se não reconhecer


def classificar_regras(assunto: str, texto: str = "") -> tuple[str, str]:
    """Classifica por regras. Retorna (complexidade, motivo); '' quando incerto."""
    base = _key(f"{assunto} {texto}")
    motivo = ""
    for padrao, canon in _MOTIVO_REGRAS:
        if re.search(padrao, base):
            motivo = canon
            break
    if re.search(_ALTA, base):
        complexidade = "alta"
    elif re.search(_BAIXA, base):
        complexidade = "baixa"
    else:
        complexidade = "media" if motivo else ""
    return complexidade, motivo


def classificar_ia(assunto: str, texto: str) -> tuple[str, str] | None:
    """Fallback por IA (Claude). Habilitado na etapa da automação de e-mail
    (requer ANTHROPIC_API_KEY). Sem a chave, retorna None e usamos só regras."""
    # Implementado na fase de ingestão do Gmail. Placeholder consciente.
    return None


def classificar(assunto: str, texto: str = "") -> tuple[str, str, str]:
    """Classificação híbrida. Retorna (complexidade, motivo, origem)."""
    comp, motivo = classificar_regras(assunto, texto)
    if comp and motivo:
        return comp, motivo, "regra"
    ia = classificar_ia(assunto, texto)
    if ia:
        comp2, motivo2 = ia
        return comp2 or comp or "media", motivo2 or motivo, "ia"
    return comp or "media", motivo, "regra"
