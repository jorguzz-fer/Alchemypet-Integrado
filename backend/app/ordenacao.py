"""Ordenação pelos títulos das colunas, igual em todas as listas.

Cada lista declara quais colunas podem ser ordenadas (nome da coluna na tela
→ expressões SQL). Nulos vão sempre para o fim, nos dois sentidos.
"""
from fastapi import HTTPException

# Teto da exportação para planilha: protege o servidor de um "exportar tudo"
# acidental; muito acima do volume de um filtro real.
MAX_EXPORTACAO = 100_000


def ordenar(stmt, sort: str | None, direcao: str | None, mapa: dict, padrao: tuple[str, str]):
    """Aplica ORDER BY. `mapa`: chave → lista de colunas (desempate em ordem)."""
    chave = sort or padrao[0]
    sentido = (direcao or (padrao[1] if not sort else "asc")).lower()
    if chave not in mapa:
        raise HTTPException(422, f"Não é possível ordenar por '{chave}'")
    if sentido not in ("asc", "desc"):
        raise HTTPException(422, "Use dir=asc ou dir=desc")
    colunas = mapa[chave]
    ordem = [
        (c.asc() if sentido == "asc" else c.desc()).nullslast()
        for c in colunas
    ]
    return stmt.order_by(*ordem)
