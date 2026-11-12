"""Ordenação pelos títulos das colunas e exportação das listas para planilha."""
import io
import os
import unittest
from datetime import date

os.environ.setdefault("DATABASE_URL", "sqlite://")

from fastapi import HTTPException  # noqa: E402
from openpyxl import load_workbook  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.database import Base  # noqa: E402
from app.filters import Filtros  # noqa: E402
from app.models import Chamado, Pendencia  # noqa: E402
from app.routers import chamado, pendencias  # noqa: E402


class OrdenacaoExportacaoTest(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite://")
        Base.metadata.create_all(engine)
        self.db = Session(engine)
        self.db.add_all([
            Pendencia(chave="a", guia="300", paciente="Bidu", clinica="Zeta", modulo="convenio",
                      ano=2026, mes=9, data_pedido=date(2026, 9, 1)),
            Pendencia(chave="b", guia="100", paciente="Amora", clinica="Alfa", modulo="particular",
                      ano=2026, mes=11, data_pedido=date(2026, 11, 2)),
            Pendencia(chave="c", guia="200", paciente="Caju", clinica="", modulo="convenio",
                      ano=2026, mes=10, data_pedido=None),
            Chamado(chave="1", assunto="B", complexidade="baixa", data=date(2026, 10, 1)),
            Chamado(chave="2", assunto="A", complexidade="alta", data=date(2026, 10, 2)),
            Chamado(chave="3", assunto="C", complexidade="media", data=None),
        ])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def listar(self, **kw):
        return pendencias.listar(f=Filtros(), ordem=None, page=1, per_page=25, db=self.db, **kw).items

    def test_ordena_pendencias_pela_coluna(self):
        self.assertEqual([p.guia for p in self.listar(sort="guia", dir="asc")], ["100", "200", "300"])
        self.assertEqual([p.paciente for p in self.listar(sort="paciente", dir="desc")], ["Caju", "Bidu", "Amora"])
        # Padrão sem sort: mais recentes primeiro (ano/mês).
        self.assertEqual([p.guia for p in self.listar(sort=None, dir=None)], ["100", "200", "300"])

    def test_coluna_ou_sentido_invalidos(self):
        with self.assertRaises(HTTPException):
            self.listar(sort="senha", dir="asc")
        with self.assertRaises(HTTPException):
            self.listar(sort="guia", dir="lado")

    def test_complexidade_por_gravidade_e_nulos_no_fim(self):
        itens = chamado.listar(complexidade=None, motivo=None, status=None, busca=None, data_de=None,
                               data_ate=None, ordem=None, sort="complexidade", dir="desc",
                               page=1, per_page=25, db=self.db).items
        self.assertEqual([c.complexidade for c in itens], ["alta", "media", "baixa"])
        itens = chamado.listar(complexidade=None, motivo=None, status=None, busca=None, data_de=None,
                               data_ate=None, ordem=None, sort="data", dir="asc",
                               page=1, per_page=25, db=self.db).items
        self.assertEqual([c.assunto for c in itens], ["B", "A", "C"])  # sem data por último

    def test_exporta_todas_as_linhas_do_filtro_na_ordem(self):
        resp = pendencias.exportar_lista(f=Filtros(modulo="convenio"), ordem=None, sort="guia", dir="asc", db=self.db)
        self.assertIn("pendencias-convenio", resp.headers["content-disposition"])
        ws = load_workbook(io.BytesIO(resp.body)).active
        cab = [c.value for c in ws[6]]
        self.assertEqual(cab[:5], ["Tipo", "Data do pedido", "Ano", "Mês", "Guia"])
        guias = [ws.cell(r, 5).value for r in range(7, ws.max_row + 1)]
        self.assertEqual(guias, ["200", "300"])  # só convênio, ordenado pela guia
        self.assertIn("tipo=convenio", ws.cell(4, 1).value)


if __name__ == "__main__":
    unittest.main()
