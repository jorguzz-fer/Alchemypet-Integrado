"""Relatórios Gerenciais de Qualidade.

A Qualidade envia o .docx do mês; o painel devolve o PDF já diagramado no
layout aprovado pela Diretoria. O .docx fica guardado para permitir regerar
o PDF quando o layout evoluir.
"""
from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import RelatorioQualidade, Usuario
from ..relatorios import gerar_pdf, ler_docx
from ..schemas import RelatorioQualidadeOut, RelatorioQualidadePage
from ..security import usuario_atual

router = APIRouter(prefix="/relatorios-qualidade", tags=["relatorios-qualidade"])

# Limite de upload: os .docx da Qualidade têm dezenas de KB; 15 MB cobre
# versões com imagens sem abrir espaço para abuso.
TAMANHO_MAXIMO = 15 * 1024 * 1024

_ROTULO_TIPO = {"executivo": "executivo", "completo": "completo"}


def _saida(r: RelatorioQualidade) -> RelatorioQualidadeOut:
    return RelatorioQualidadeOut(
        id=r.id, arquivo=r.arquivo, tipo=r.tipo, titulo=r.titulo, periodo=r.periodo,
        paginas=r.paginas, setores=r.setores, pontos_atencao=r.pontos_atencao,
        tamanho_pdf=r.tamanho_pdf,
        enviado_por_nome=r.enviado_por.nome if r.enviado_por else None,
        created_at=r.created_at,
    )


def _nome_base(r: RelatorioQualidade) -> str:
    """Nome amigável do arquivo entregue (sem acentos/barras)."""
    bruto = f"relatorio-qualidade-{r.tipo}-{r.periodo or ''}".lower()
    limpo = "".join(c if c.isalnum() or c in "-_" else "-" for c in bruto)
    while "--" in limpo:
        limpo = limpo.replace("--", "-")
    return limpo.strip("-") or "relatorio-qualidade"


def _processar(conteudo: bytes) -> tuple[dict, bytes]:
    """.docx → (metadados, PDF). Erros de leitura viram 422 com a causa."""
    try:
        rel = ler_docx(conteudo)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(422, f"Não foi possível ler o documento: {exc}") from exc
    try:
        pdf, paginas = gerar_pdf(rel)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(500, f"Falha ao gerar o PDF: {exc}") from exc
    meta = {
        "tipo": _ROTULO_TIPO.get(rel.tipo, "executivo"),
        "titulo": f"{rel.titulo} — {rel.subtitulo}".strip(" —")[:200],
        "periodo": (rel.periodo or "")[:120],
        "setores": len(rel.setores) or len([s for s in rel.secoes if s.parte.startswith("PARTE II")]),
        "pontos_atencao": sum(1 for s in rel.setores if s.tem_atencao),
        "paginas": paginas,
    }
    return meta, pdf


@router.get("", response_model=RelatorioQualidadePage)
def listar(
    busca: str | None = None,
    tipo: str | None = None,
    ordem: str | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
):
    stmt = select(RelatorioQualidade)
    if tipo:
        stmt = stmt.where(RelatorioQualidade.tipo == tipo)
    if busca:
        termo = f"%{busca.lower()}%"
        stmt = stmt.where(
            func.lower(RelatorioQualidade.titulo).like(termo)
            | func.lower(RelatorioQualidade.periodo).like(termo)
            | func.lower(RelatorioQualidade.arquivo).like(termo)
        )
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    if ordem == "antigos":
        stmt = stmt.order_by(RelatorioQualidade.created_at.asc())
    else:
        stmt = stmt.order_by(RelatorioQualidade.created_at.desc())
    itens = list(db.scalars(stmt.offset((page - 1) * per_page).limit(per_page)))
    return RelatorioQualidadePage(
        total=total, page=page, per_page=per_page, items=[_saida(r) for r in itens]
    )


@router.post("/importar", response_model=RelatorioQualidadeOut, status_code=201)
async def importar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(usuario_atual),
):
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(400, "Envie o relatório em .docx")
    conteudo = await file.read()
    if not conteudo:
        raise HTTPException(400, "O arquivo enviado está vazio")
    if len(conteudo) > TAMANHO_MAXIMO:
        raise HTTPException(413, "Arquivo acima de 15 MB")

    meta, pdf = _processar(conteudo)
    r = RelatorioQualidade(
        arquivo=file.filename[:260], docx=conteudo, pdf=pdf,
        tamanho_pdf=len(pdf), enviado_por_id=usuario.id, **meta,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return _saida(r)


@router.post("/{relatorio_id}/regerar", response_model=RelatorioQualidadeOut)
def regerar(relatorio_id: str, db: Session = Depends(get_db)):
    """Refaz o PDF a partir do .docx guardado (útil após ajustes de layout)."""
    r = db.get(RelatorioQualidade, relatorio_id)
    if not r:
        raise HTTPException(404, "Relatório não encontrado")
    meta, pdf = _processar(r.docx)
    r.pdf, r.tamanho_pdf = pdf, len(pdf)
    for k, v in meta.items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return _saida(r)


@router.get("/{relatorio_id}.pdf")
def baixar_pdf(relatorio_id: str, db: Session = Depends(get_db)):
    r = db.get(RelatorioQualidade, relatorio_id)
    if not r:
        raise HTTPException(404, "Relatório não encontrado")
    return Response(
        content=r.pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{_nome_base(r)}.pdf"'},
    )


@router.get("/{relatorio_id}.docx")
def baixar_docx(relatorio_id: str, db: Session = Depends(get_db)):
    r = db.get(RelatorioQualidade, relatorio_id)
    if not r:
        raise HTTPException(404, "Relatório não encontrado")
    return Response(
        content=r.docx,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{_nome_base(r)}.docx"'},
    )


@router.delete("/{relatorio_id}", status_code=204)
def excluir(relatorio_id: str, db: Session = Depends(get_db)):
    r = db.get(RelatorioQualidade, relatorio_id)
    if not r:
        raise HTTPException(404, "Relatório não encontrado")
    db.delete(r)
    db.commit()
    return Response(status_code=204)
