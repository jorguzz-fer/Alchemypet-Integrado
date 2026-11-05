"""Exclusão em lote (seleção na tela e filtro inteiro)."""
import os
import unittest

os.environ.setdefault("DATABASE_URL", "sqlite://")

from fastapi import HTTPException  # noqa: E402
from sqlalchemy import create_engine, func, select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.database import Base  # noqa: E402
from app.exclusao_lote import ExclusaoFiltroIn, ExclusaoLoteIn  # noqa: E402
from app.filters import Filtros  # noqa: E402
from app.models import Pendencia, Pop, Tratativa  # noqa: E402
from app.routers import pendencias, pop  # noqa: E402


class ExclusaoLoteTest(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite://")
        Base.metadata.create_all(engine)
        self.db = Session(engine)
        self.ps = [
            Pendencia(chave=f"k{i}", guia=str(i), modulo="convenio" if i < 3 else "particular")
            for i in range(5)
        ]
        self.db.add_all(self.ps)
        self.db.flush()
        self.db.add(Tratativa(pendencia_id=self.ps[0].id, acao="ligou"))
        self.db.add_all([Pop(chave="a", numero="1", tipo="novo"), Pop(chave="b", numero="2", tipo="atualizado")])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def contar(self, modelo):
        return self.db.scalar(select(func.count()).select_from(modelo))

    def test_lote_apaga_selecionadas_e_tratativas(self):
        ids = [self.ps[0].id, self.ps[1].id, "inexistente"]
        r = pendencias.excluir_lote(ExclusaoLoteIn(ids=ids), self.db)
        self.assertEqual(r.excluidas, 2)  # o id inexistente é ignorado
        self.assertEqual(self.contar(Pendencia), 3)
        self.assertEqual(self.contar(Tratativa), 0)

    def test_filtro_exige_palavra_e_total_conferido(self):
        f = Filtros(modulo="convenio")
        with self.assertRaises(HTTPException) as e:
            pendencias.excluir_por_filtro(ExclusaoFiltroIn(total_esperado=3, confirmacao="sim"), f, self.db)
        self.assertEqual(e.exception.status_code, 400)
        with self.assertRaises(HTTPException) as e:
            pendencias.excluir_por_filtro(ExclusaoFiltroIn(total_esperado=4, confirmacao="EXCLUIR"), f, self.db)
        self.assertEqual(e.exception.status_code, 409)  # a tela viu outro número
        self.assertEqual(self.contar(Pendencia), 5)
        r = pendencias.excluir_por_filtro(ExclusaoFiltroIn(total_esperado=3, confirmacao="excluir"), f, self.db)
        self.assertEqual(r.excluidas, 3)
        restantes = set(self.db.scalars(select(Pendencia.modulo)))
        self.assertEqual(restantes, {"particular"})

    def test_pop_por_filtro(self):
        r = pop.excluir_por_filtro(ExclusaoFiltroIn(total_esperado=1, confirmacao="EXCLUIR"),
                                   tipo="novo", ano=None, area=None, busca=None, db=self.db)
        self.assertEqual(r.excluidas, 1)
        self.assertEqual(self.contar(Pop), 1)


if __name__ == "__main__":
    unittest.main()
