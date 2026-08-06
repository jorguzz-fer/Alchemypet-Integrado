"""Endpoints de Chamados (recebidos por e-mail)."""
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..chamado_classifier import classificar, normalizar_complexidade, normalizar_motivo
from ..chamado_importer import importar_chamados_xlsx
from ..database import get_db
from ..models import Chamado
from ..reports import chamados_pdf, chamados_xlsx
from ..schemas import (
    ChamadoCreate,
    ChamadoDashboardOut,
    ChamadoImportResult,
    ChamadoOut,
    ChamadoPage,
    ChamadoUpdate,
    TopItem,
)

router = APIRouter(prefix="/chamados", tags=["chamados"])

# Ordem canônica das complexidades no gráfico.
_ORDEM_COMPLEX = {"alta": 0, "media": 1, "baixa": 2}
_ROTULO_COMPLEX = {"alta": "Alta", "media": "Média", "baixa": "Baixa"}


def _filtrar(stmt, complexidade, motivo, status, busca):
    if complexidade:
        stmt = stmt.where(Chamado.complexidade == complexidade)
    if motivo:
        stmt = stmt.where(Chamado.motivo == motivo)
    if status:
        stmt = stmt.where(Chamado.status == status)
    if busca:
        termo = f"%{busca.lower()}%"
        stmt = stmt.where(
            func.lower(Chamado.assunto).like(termo)
            | func.lower(Chamado.remetente).like(termo)
            | func.lower(Chamado.motivo).like(termo)
        )
    return stmt


@router.get("", response_model=ChamadoPage)
def listar(
    complexidade: str | None = None,
    motivo: str | None = None,
    status: str | None = None,
    busca: str | None = None,
    ordem: str | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=500),
    db: Session = Depends(get_db),
):
    base = _filtrar(select(Chamado), complexidade, motivo, status, busca)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    if ordem == "antigos":
        base = base.order_by(Chamado.data.asc().nullsfirst(), Chamado.created_at.asc())
    else:  # "recentes" (padrão)
        base = base.order_by(Chamado.data.desc().nullslast(), Chamado.created_at.desc())
    stmt = base.offset((page - 1) * per_page).limit(per_page)
    items = list(db.scalars(stmt))
    return ChamadoPage(total=total, page=page, per_page=per_page, items=items)


@router.get("/dashboard", response_model=ChamadoDashboardOut)
def dashboard(db: Session = Depends(get_db)):
    total = db.scalar(select(func.count()).select_from(Chamado)) or 0
    resolvidos = db.scalar(select(func.count()).where(Chamado.status == "resolvido")) or 0
    abertos = total - resolvidos
    taxa = round(100.0 * resolvidos / total, 1) if total else 0.0

    motivo_rows = db.execute(
        select(Chamado.motivo, func.count())
        .group_by(Chamado.motivo)
        .order_by(func.count().desc())
    ).all()
    por_motivo = [TopItem(nome=(m or "Sem motivo"), total=q) for m, q in motivo_rows]

    comp_rows = db.execute(
        select(Chamado.complexidade, func.count()).group_by(Chamado.complexidade)
    ).all()
    por_complexidade = [
        TopItem(nome=_ROTULO_COMPLEX.get(c, c or "—"), total=q)
        for c, q in sorted(comp_rows, key=lambda cr: _ORDEM_COMPLEX.get(cr[0], 9))
    ]

    return ChamadoDashboardOut(
        total=total, abertos=abertos, resolvidos=resolvidos,
        taxa_resolucao=taxa, por_motivo=por_motivo, por_complexidade=por_complexidade,
    )


@router.get("/export.xlsx")
def exportar_xlsx(db: Session = Depends(get_db)):
    conteudo = chamados_xlsx(db)
    return Response(
        content=conteudo,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="chamados-por-email.xlsx"'},
    )


@router.get("/export.pdf")
def exportar_pdf(db: Session = Depends(get_db)):
    conteudo = chamados_pdf(db)
    return Response(
        content=conteudo,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="chamados-por-email.pdf"'},
    )


@router.get("/motivos", response_model=list[str])
def motivos(db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Chamado.motivo).where(Chamado.motivo != "").distinct().order_by(Chamado.motivo)
    ).all()
    return list(rows)


@router.post("", response_model=ChamadoOut, status_code=201)
def criar(dados: ChamadoCreate, db: Session = Depends(get_db)):
    campos = dados.model_dump()
    complexidade = normalizar_complexidade(campos.get("complexidade", ""))
    motivo = normalizar_motivo(campos.get("motivo", ""))
    origem = "manual"
    # Sem complexidade/motivo informados: classifica (regras + IA quando ativa).
    if not complexidade or not motivo:
        c2, m2, origem = classificar(campos["assunto"], campos.get("texto", ""))
        complexidade = complexidade or c2
        motivo = motivo or m2
    campos["complexidade"] = complexidade
    campos["motivo"] = motivo
    c = Chamado(chave=uuid4().hex, origem_classe=origem, status="aberto", **campos)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.patch("/{chamado_id}", response_model=ChamadoOut)
def atualizar(chamado_id: str, dados: ChamadoUpdate, db: Session = Depends(get_db)):
    c = db.get(Chamado, chamado_id)
    if not c:
        raise HTTPException(404, "Chamado não encontrado")
    enviados = dados.model_dump(exclude_unset=True)
    if "complexidade" in enviados:
        enviados["complexidade"] = normalizar_complexidade(enviados["complexidade"])
    if "motivo" in enviados:
        enviados["motivo"] = normalizar_motivo(enviados["motivo"])
    for k, v in enviados.items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/{chamado_id}", status_code=204)
def excluir(chamado_id: str, db: Session = Depends(get_db)):
    c = db.get(Chamado, chamado_id)
    if not c:
        raise HTTPException(404, "Chamado não encontrado")
    db.delete(c)
    db.commit()
    return Response(status_code=204)


@router.post("/importar", response_model=ChamadoImportResult)
async def importar(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(400, "Envie um arquivo .xlsx")
    conteudo = await file.read()
    try:
        res = importar_chamados_xlsx(db, conteudo)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(422, f"Falha ao processar a planilha: {exc}") from exc
    return ChamadoImportResult(**res)
