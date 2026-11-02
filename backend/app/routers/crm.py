"""CRM: contas (clínicas e leads) e importação das exportações do Pocket."""
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import (
    Clinica,
    ClinicaLaboratorio,
    Laboratorio,
    Portador,
    Regiao,
    TransferenciaPortador,
)
from ..pocket_importer import importar_arquivos
from ..schemas import (
    ContaOut,
    ContaPage,
    CrmContagem,
    CrmFiltrosOut,
    CrmImportResult,
    CrmResumoOut,
)
from ..security import exige_admin

router = APIRouter(prefix="/crm", tags=["crm"])

_EXTENSOES = (".csv", ".xlsx", ".xlsm")
_MAX_BYTES = 20 * 1024 * 1024


def _conta_out(c: Clinica) -> ContaOut:
    dados = {k: getattr(c, k) for k in ContaOut.model_fields if k not in ("regiao", "laboratorios")}
    dados["regiao"] = c.regiao.nome if c.regiao else ""
    dados["laboratorios"] = sorted(lab.nome for lab in c.laboratorios)
    return ContaOut(**dados)


@router.post("/importar-pocket", response_model=CrmImportResult, dependencies=[Depends(exige_admin)])
async def importar_pocket(
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    arquivos = []
    for f in files:
        nome = f.filename or "arquivo"
        if not nome.lower().endswith(_EXTENSOES):
            raise HTTPException(400, f"{nome}: envie arquivos .csv ou .xlsx exportados do Pocket")
        conteudo = await f.read()
        if len(conteudo) > _MAX_BYTES:
            raise HTTPException(413, f"{nome}: arquivo maior que 20 MB")
        arquivos.append((nome, conteudo))
    try:
        resultado = importar_arquivos(db, arquivos)
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        raise HTTPException(422, f"Falha ao importar: {exc}") from exc
    return CrmImportResult(arquivos=resultado)


def _filtrar(stmt, busca, etapa, uso, regiao, vendedor):
    stmt = stmt.where(Clinica.etapa != "")  # só contas do CRM
    if etapa:
        stmt = stmt.where(Clinica.etapa == etapa)
    if uso == "com":
        stmt = stmt.where(Clinica.em_uso.is_(True))
    elif uso == "sem":
        stmt = stmt.where(Clinica.em_uso.is_(False))
    elif uso == "sem_info":
        stmt = stmt.where(Clinica.em_uso.is_(None))
    if regiao:
        stmt = stmt.join(Regiao, Clinica.regiao_id == Regiao.id).where(Regiao.nome == regiao)
    if vendedor:
        stmt = stmt.where(Clinica.vendedor == vendedor)
    if busca:
        termo = f"%{busca.lower()}%"
        stmt = stmt.where(or_(
            func.lower(Clinica.nome).like(termo),
            func.lower(func.coalesce(Clinica.codigo_pocket, "")).like(termo),
            func.lower(Clinica.cidade).like(termo),
            Clinica.telefone_norm.like(f"%{''.join(ch for ch in busca if ch.isdigit()) or '§'}%"),
        ))
    return stmt


@router.get("/contas", response_model=ContaPage)
def listar_contas(
    busca: str | None = None,
    etapa: str | None = None,
    uso: str | None = None,
    regiao: str | None = None,
    vendedor: str | None = None,
    ordem: str | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
):
    base = _filtrar(select(Clinica), busca, etapa, uso, regiao, vendedor)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    if ordem == "os":
        base = base.order_by(Clinica.qtd_os_periodo.desc(), Clinica.nome)
    else:
        base = base.order_by(Clinica.nome)
    stmt = (
        base.options(selectinload(Clinica.regiao), selectinload(Clinica.laboratorios))
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    items = [_conta_out(c) for c in db.scalars(stmt)]
    return ContaPage(total=total, page=page, per_page=per_page, items=items)


def _contagem(db: Session, coluna, *where, limite: int = 10) -> list[CrmContagem]:
    stmt = (
        select(coluna, func.count())
        .where(Clinica.etapa != "", *where)
        .group_by(coluna)
        .order_by(func.count().desc())
        .limit(limite)
    )
    return [CrmContagem(label=label or "Não informado", total=n) for label, n in db.execute(stmt)]


@router.get("/resumo", response_model=CrmResumoOut)
def resumo(db: Session = Depends(get_db)):
    def conta(*where) -> int:
        return db.scalar(select(func.count()).select_from(Clinica).where(Clinica.etapa != "", *where)) or 0

    cliente = Clinica.etapa == "cliente"
    por_regiao = [
        CrmContagem(label=nome, total=n)
        for nome, n in db.execute(
            select(Regiao.nome, func.count())
            .join(Clinica, Clinica.regiao_id == Regiao.id)
            .where(cliente)
            .group_by(Regiao.nome)
            .order_by(func.count().desc())
            .limit(12)
        )
    ]
    concorrentes = [
        CrmContagem(label=nome, total=n)
        for nome, n in db.execute(
            select(Laboratorio.nome, func.count())
            .join(ClinicaLaboratorio, ClinicaLaboratorio.laboratorio_id == Laboratorio.id)
            .group_by(Laboratorio.nome)
            .order_by(func.count().desc())
            .limit(10)
        )
    ]
    return CrmResumoOut(
        contas=conta(),
        clientes=conta(cliente),
        leads=conta(Clinica.etapa == "lead"),
        com_uso=conta(cliente, Clinica.em_uso.is_(True)),
        sem_uso=conta(cliente, Clinica.em_uso.is_(False)),
        uso_sem_info=conta(cliente, Clinica.em_uso.is_(None)),
        clientes_com_dados_de_lead=conta(cliente, Clinica.vendedor != ""),
        os_no_periodo=db.scalar(select(func.coalesce(func.sum(Clinica.qtd_os_periodo), 0))) or 0,
        portadores=db.scalar(select(func.count()).select_from(Portador)) or 0,
        transferencias=db.scalar(select(func.count()).select_from(TransferenciaPortador)) or 0,
        transferencias_aprovadas=db.scalar(
            select(func.count()).select_from(TransferenciaPortador).where(TransferenciaPortador.aprovado_por != "")
        ) or 0,
        por_regiao=por_regiao,
        por_vendedor=_contagem(db, Clinica.vendedor, Clinica.vendedor != ""),
        por_captacao=_contagem(db, Clinica.captacao, Clinica.captacao != ""),
        concorrentes=concorrentes,
    )


@router.get("/filtros", response_model=CrmFiltrosOut)
def filtros(db: Session = Depends(get_db)):
    regioes = list(db.scalars(select(Regiao.nome).order_by(Regiao.nome)))
    vendedores = list(db.scalars(
        select(Clinica.vendedor).where(Clinica.vendedor != "").distinct().order_by(Clinica.vendedor)
    ))
    return CrmFiltrosOut(regioes=regioes, vendedores=vendedores)
