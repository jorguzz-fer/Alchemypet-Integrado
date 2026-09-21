"""Endpoint de importação da planilha .xlsx."""
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..database import get_db
from ..importer import importar_xlsx
from ..motivos import MODULOS, normalizar_modulo
from ..schemas import ImportResult

router = APIRouter(tags=["importacao"])


@router.post("/importar", response_model=ImportResult)
async def importar(
    file: UploadFile = File(...),
    modulo: str = Form("convenio"),
    db: Session = Depends(get_db),
):
    modulo = normalizar_modulo(modulo) or ""
    if modulo not in MODULOS:
        raise HTTPException(422, "Módulo inválido")
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(400, "Envie um arquivo .xlsx")
    conteudo = await file.read()
    try:
        res = importar_xlsx(db, conteudo, modulo=modulo)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(422, f"Falha ao processar a planilha: {exc}") from exc
    return ImportResult(**res)
