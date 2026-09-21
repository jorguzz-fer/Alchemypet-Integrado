"""Catálogo de motivos das pendências e regras de sincronização de status.

Os motivos são uma lista fechada (substituem o texto livre "Informação
necessária"). "Observação" é o motivo genérico: exige descrição no campo
`observacao`.
"""
import re
import unicodedata

MOTIVOS_PENDENCIA: tuple[str, ...] = (
    "Confirmar exame",
    "Requisição sem sinalização de exame",
    "Exames não lançados no convênio",
    "Confirmar dados do paciente",
    "Confirmar clínica",
    "Amostra sem requisição",
    "Clínica desativada",
    "Observação",
)
MOTIVO_OBSERVACAO = "Observação"

MODULOS = ("convenio", "particular")
# Nome antigo do módulo particular (rotas/planilhas antigas).
_ALIAS_MODULO = {"triagem": "particular"}


def normalizar_modulo(m: str | None) -> str | None:
    """'triagem' → 'particular'; vazio/'todos' → None (todos os módulos)."""
    if not m or m == "todos":
        return None
    return _ALIAS_MODULO.get(m, m)


def _key(s: str) -> str:
    s = "".join(c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).strip().lower()


_CANON = {_key(m): m for m in MOTIVOS_PENDENCIA}

# Palavras-chave → motivo, para classificar textos livres (legado/planilhas).
_REGRAS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Clínica desativada", ("desativad", "inativ")),
    ("Exames não lançados no convênio", ("lancar exame", "lancar no convenio", "nao lancad", "lancamento no convenio", "lancar o exame")),
    ("Requisição sem sinalização de exame", ("sem sinalizacao", "sinalizar exame", "requisicao sem exame", "sem exame na requisicao")),
    ("Amostra sem requisição", ("sem requisicao", "amostra sem")),
    ("Confirmar dados do paciente", ("dados do paciente", "nome do paciente", "confirmar paciente", "tutor", "especie", "raca", "idade")),
    ("Confirmar clínica", ("confirmar clinica", "qual clinica", "clinica correta", "codigo da clinica")),
    ("Confirmar exame", ("confirmar exame", "qual exame", "confirmar o exame", "exame solicitado", "confirmar material")),
)


def classificar_motivo(texto: str) -> tuple[str, str]:
    """Texto livre → (motivo, observacao). Casa por nome exato ou palavra-chave;
    sem correspondência vira "Observação" com o texto na observação."""
    t = _key(texto)
    if not t:
        return "", ""
    if t in _CANON:
        return _CANON[t], ""
    for motivo, chaves in _REGRAS:
        if any(k in t for k in chaves):
            return motivo, ""
    return MOTIVO_OBSERVACAO, (texto or "").strip()


def normalizar_motivo(m: str | None) -> str:
    """Aceita variações de caixa/acento; desconhecido → ''. """
    if not m:
        return ""
    return _CANON.get(_key(m), "")


_STATUS_POR_GESTAO = {"aberto": "pendente", "andamento": "tratativa", "resolvido": "concluido"}
_GESTAO_POR_STATUS = {v: k for k, v in _STATUS_POR_GESTAO.items()}


def status_por_gestao(gestao: str) -> str:
    return _STATUS_POR_GESTAO.get(gestao, "pendente")


def gestao_por_status(status: str) -> str:
    return _GESTAO_POR_STATUS.get(status, "aberto")
