"""Importação da planilha 'APRESENTAÇÃO CHAMADOS VIA E-MAIL'.

Uma aba simples com colunas: [DATA] | ASSUNTO | LINK GMAIL | COMPLEXIDADE | MOTIVOS
(+ colunas agregadas que ignoramos, pois recalculamos os agregados a partir
da lista). Upsert idempotente pela chave natural (link do Gmail, ou hash do
assunto+motivo quando não houver link).
"""
import hashlib
import re
import unicodedata
from io import BytesIO

import openpyxl
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .chamado_classifier import normalizar_complexidade, normalizar_motivo
from .importer import _to_date
from .models import Chamado

_HDR = {
    "data": {"data", "data do chamado", "data chamado", "dt", "recebido em"},
    "assunto": {"assunto", "cliente", "clinica"},
    "link": {"link gmail", "link", "e-mail", "email"},
    "complexidade": {"complexidade"},
    "motivo": {"motivos", "motivo"},
}


def _key(s) -> str:
    s = "".join(c for c in unicodedata.normalize("NFD", str(s or "")) if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).strip().lower()


def _norm(s) -> str:
    if s is None:
        return ""
    return re.sub(r"\s+", " ", str(s)).strip()


def _chave(link: str, assunto: str, motivo: str, idx: int) -> str:
    raw = link.strip() or f"{assunto}|{motivo}|{idx}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:32]


def _colmap(header) -> dict:
    cm: dict[str, int] = {}
    for i, cell in enumerate(header):
        k = _key(cell)
        for campo, syns in _HDR.items():
            if campo not in cm and k in syns:
                cm[campo] = i
    return cm


def importar_chamados_xlsx(db: Session, conteudo: bytes) -> dict:
    wb = openpyxl.load_workbook(BytesIO(conteudo), data_only=True, read_only=True)
    ws = wb.worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    if not rows:
        return {"importados": 0, "total": 0}

    # Cabeçalho: primeira linha com "assunto" e "complexidade".
    h = 0
    for i in range(min(5, len(rows))):
        ks = {_key(c) for c in rows[i] if c is not None}
        if "assunto" in ks:
            h = i
            break
    cm = _colmap(rows[h])
    if "assunto" not in cm:
        raise ValueError("Cabeçalho da planilha de chamados não reconhecido")

    def get(row, campo):
        i = cm.get(campo)
        return row[i] if i is not None and i < len(row) else None

    importados = 0
    staged: dict[str, Chamado] = {}
    for r in range(h + 1, len(rows)):
        row = rows[r]
        assunto = _norm(get(row, "assunto"))
        if not assunto:
            continue
        link = _norm(get(row, "link"))
        complexidade = normalizar_complexidade(_norm(get(row, "complexidade")))
        motivo = normalizar_motivo(_norm(get(row, "motivo")))
        data = _to_date(get(row, "data")) if "data" in cm else None
        chave = _chave(link, assunto, motivo, r)

        existente = staged.get(chave) or db.scalar(select(Chamado).where(Chamado.chave == chave))
        campos = dict(
            assunto=assunto, link_gmail=link,
            complexidade=complexidade, motivo=motivo, origem_classe="planilha",
        )
        if existente:
            # Preserva status/resposta (controle no painel); atualiza dados.
            for k, v in campos.items():
                setattr(existente, k, v)
            # Data: só sobrescreve quando a planilha traz uma (não apaga
            # data preenchida manualmente ao reimportar planilha antiga sem coluna).
            if data is not None:
                existente.data = data
        else:
            novo = Chamado(chave=chave, status="aberto", data=data, **campos)
            db.add(novo)
            staged[chave] = novo
            importados += 1

    db.commit()
    total = db.scalar(select(func.count()).select_from(Chamado)) or 0
    return {"importados": importados, "total": int(total)}
