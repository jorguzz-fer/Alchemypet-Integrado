"""Exclusão em lote, igual para todas as listas (pendências, chamados, POPs,
relatórios): por ids selecionados na tela ou por todo o filtro atual."""
from collections.abc import Callable

from fastapi import HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

PALAVRA_EXCLUSAO = "EXCLUIR"
MAX_LOTE = 500


class ExclusaoLoteIn(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=MAX_LOTE)


class ExclusaoFiltroIn(BaseModel):
    # Quantos a tela mostrou ao pedir a confirmação: se a lista mudou nesse
    # meio-tempo (importação, outra pessoa editando), nada é apagado.
    total_esperado: int = Field(ge=1)
    confirmacao: str


class ExclusaoOut(BaseModel):
    excluidas: int


def _apagar(db: Session, modelo, ids: list[str], dependentes: Callable[[list[str]], None] | None) -> int:
    for i in range(0, len(ids), MAX_LOTE):
        lote = ids[i:i + MAX_LOTE]
        if dependentes:
            dependentes(lote)
        db.execute(delete(modelo).where(modelo.id.in_(lote)))
    db.commit()
    return len(ids)


def excluir_ids(db: Session, modelo, body: ExclusaoLoteIn, dependentes=None) -> ExclusaoOut:
    ids = list(db.scalars(select(modelo.id).where(modelo.id.in_(set(body.ids)))))
    return ExclusaoOut(excluidas=_apagar(db, modelo, ids, dependentes))


def excluir_filtro(db: Session, modelo, base, body: ExclusaoFiltroIn, dependentes=None) -> ExclusaoOut:
    """`base` é o select já filtrado (de qualquer coluna do modelo)."""
    if body.confirmacao.strip().upper() != PALAVRA_EXCLUSAO:
        raise HTTPException(400, f'Digite "{PALAVRA_EXCLUSAO}" para confirmar a exclusão')
    ids_stmt = base.with_only_columns(modelo.id).order_by(None)
    ids = list(db.scalars(ids_stmt))
    if len(ids) != body.total_esperado:
        raise HTTPException(
            409,
            f"A lista mudou: agora são {len(ids)} registro(s) neste filtro, não "
            f"{body.total_esperado}. Confira e confirme de novo.",
        )
    return ExclusaoOut(excluidas=_apagar(db, modelo, ids, dependentes))


def contar(db: Session, base) -> int:
    return db.scalar(select(func.count()).select_from(base.subquery())) or 0
