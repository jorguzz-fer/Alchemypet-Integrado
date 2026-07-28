"""Endpoint de importação da planilha .xlsx."""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..database import get_db
from ..importer import importar_xlsx
from ..schemas import ImportResult

router = APIRouter(tags=["importacao"])


@router.post("/importar", response_model=ImportResult)
async def importar(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(400, "Envie um arquivo .xlsx")
    conteudo = await file.read()
    try:
        res = importar_xlsx(db, conteudo)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(422, f"Falha ao processar a planilha: {exc}") from exc
    return ImportResult(**res)
