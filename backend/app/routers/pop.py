"""Endpoints do Controle de POPs."""
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Pop
from ..pop_importer import classificar_area, importar_pops_xlsx
from ..schemas import (
    PopAno,
    PopCreate,
    PopDashboardOut,
    PopImportResult,
    PopOut,
    PopPage,
    PopUpdate,
    TopItem,
)

router = APIRouter(prefix="/pops", tags=["pops"])


def _filtrar(stmt, ano, tipo, area, busca):
    if ano:
        stmt = stmt.where(Pop.ano == ano)
    if tipo:
        stmt = stmt.where(Pop.tipo == tipo)
    if area:
        stmt = stmt.where(Pop.area == area)
    if busca:
        termo = f"%{busca.lower()}%"
        stmt = stmt.where(
            func.lower(Pop.nome).like(termo) | func.lower(Pop.numero).like(termo)
        )
    return stmt


@router.get("", response_model=PopPage)
def listar(
    ano: int | None = None,
    tipo: str | None = None,
    area: str | None = None,
    busca: str | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=500),
    db: Session = Depends(get_db),
):
    base = _filtrar(select(Pop), ano, tipo, area, busca)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    stmt = base.order_by(Pop.ano.desc(), Pop.numero).offset((page - 1) * per_page).limit(per_page)
    items = list(db.scalars(stmt))
    return PopPage(total=total, page=page, per_page=per_page, items=items)


@router.get("/dashboard", response_model=PopDashboardOut)
def dashboard(db: Session = Depends(get_db)):
    total = db.scalar(select(func.count()).select_from(Pop)) or 0
    novos = db.scalar(select(func.count()).where(Pop.tipo == "novo")) or 0
    atualizados = db.scalar(select(func.count()).where(Pop.tipo == "atualizado")) or 0

    # Por ano (novos/atualizados).
    linhas = db.execute(
        select(Pop.ano, Pop.tipo, func.count()).group_by(Pop.ano, Pop.tipo)
    ).all()
    agg: dict[int | None, dict[str, int]] = {}
    for ano, tipo, qtd in linhas:
        d = agg.setdefault(ano, {"novo": 0, "atualizado": 0})
        d[tipo] = qtd
    por_ano = [
        PopAno(ano=a, novos=v["novo"], atualizados=v["atualizado"], total=v["novo"] + v["atualizado"])
        for a, v in sorted(agg.items(), key=lambda kv: (kv[0] is None, kv[0]))
    ]

    anos = [a for a in agg if a is not None]
    periodo = ""
    if anos:
        lo, hi = min(anos), max(anos)
        periodo = f"{lo}" if lo == hi else f"{lo}–{hi}"

    # Por área.
    area_rows = db.execute(
        select(Pop.area, func.count()).group_by(Pop.area).order_by(func.count().desc())
    ).all()
    por_area = [
        TopItem(nome=(a or "Sem classificação"), total=q) for a, q in area_rows
    ]

    return PopDashboardOut(
        total=total, novos=novos, atualizados=atualizados,
        periodo=periodo, por_ano=por_ano, por_area=por_area,
    )


@router.get("/areas", response_model=list[str])
def areas(db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Pop.area).where(Pop.area != "").distinct().order_by(Pop.area)
    ).all()
    return list(rows)


@router.post("", response_model=PopOut, status_code=201)
def criar(dados: PopCreate, db: Session = Depends(get_db)):
    campos = dados.model_dump()
    if not campos.get("area"):
        campos["area"] = classificar_area(campos.get("nome", ""))
    p = Pop(chave=uuid4().hex, **campos)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.patch("/{pop_id}", response_model=PopOut)
def atualizar(pop_id: str, dados: PopUpdate, db: Session = Depends(get_db)):
    p = db.get(Pop, pop_id)
    if not p:
        raise HTTPException(404, "POP não encontrado")
    for k, v in dados.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{pop_id}", status_code=204)
def excluir(pop_id: str, db: Session = Depends(get_db)):
    p = db.get(Pop, pop_id)
    if not p:
        raise HTTPException(404, "POP não encontrado")
    db.delete(p)
    db.commit()
    return Response(status_code=204)


@router.post("/importar", response_model=PopImportResult)
async def importar(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(400, "Envie um arquivo .xlsx")
    conteudo = await file.read()
    try:
        res = importar_pops_xlsx(db, conteudo)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(422, f"Falha ao processar a planilha: {exc}") from exc
    return PopImportResult(**res)
