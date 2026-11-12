"""Resposta HTTP de download de planilha."""
from datetime import date

from fastapi import Response

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _xlsx(conteudo: bytes, nome: str) -> Response:
    arquivo = f"{nome}-{date.today().isoformat()}.xlsx"
    return Response(
        content=conteudo,
        media_type=XLSX,
        headers={"Content-Disposition": f'attachment; filename="{arquivo}"'},
    )
