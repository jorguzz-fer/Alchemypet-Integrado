"""Testes das regras do CRM (funil e atividades), chamando as rotas direto."""
import os
import unittest

os.environ.setdefault("DATABASE_URL", "sqlite://")

from fastapi import HTTPException  # noqa: E402
from sqlalchemy import create_engine, select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.database import Base  # noqa: E402
from app.models import Atividade, Usuario  # noqa: E402
from app.routers import crm  # noqa: E402
from app.schemas import AtividadeIn, ContaCreate, ContaUpdate  # noqa: E402


class CrmApiTest(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite://")
        Base.metadata.create_all(engine)
        self.db = Session(engine)
        self.ana = Usuario(nome="Ana", email="ana@x.com", perfil="atendente")
        self.bia = Usuario(nome="Bia", email="bia@x.com", perfil="atendente")
        self.db.add_all([self.ana, self.bia])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def _nova(self, **kw):
        dados = {"nome": "Pet Novo", "whatsapp": "(11) 97777-7777", **kw}
        return crm.criar_conta(ContaCreate(**dados), self.db, self.ana)

    def test_criar_lead_registra_criacao(self):
        c = self._nova(temperatura="quente")
        self.assertEqual((c.etapa, c.temperatura, c.origem), ("lead", "quente", "manual"))
        ats = crm.listar_atividades(c.id, self.db)
        self.assertEqual([a.descricao for a in ats], ["Criação do lead"])
        self.assertEqual(ats[0].usuario_nome, "Ana")

    def test_telefone_duplicado(self):
        self._nova()
        with self.assertRaises(HTTPException) as e:
            self._nova(nome="Outro", whatsapp="11977777777")
        self.assertEqual(e.exception.status_code, 409)

    def test_mudar_etapa_registra_e_exige_motivo_na_saida(self):
        c = self._nova()
        c = crm.atualizar_conta(c.id, ContaUpdate(etapa="contratos"), self.db, self.ana)
        self.assertEqual(c.etapa, "contratos")
        with self.assertRaises(HTTPException) as e:
            crm.atualizar_conta(c.id, ContaUpdate(etapa="bloqueado"), self.db, self.ana)
        self.assertEqual(e.exception.status_code, 422)
        c = crm.atualizar_conta(
            c.id, ContaUpdate(etapa="bloqueado", motivo_encerramento="Inadimplente"), self.db, self.ana
        )
        self.assertEqual((c.etapa, c.motivo_encerramento), ("bloqueado", "Inadimplente"))
        textos = [a.descricao for a in crm.listar_atividades(c.id, self.db)]
        self.assertIn("Etapa: Contratos → Bloqueado. Motivo: Inadimplente", textos)
        self.assertIn("Etapa: Lead → Contratos", textos)

    def test_funil_conta_por_etapa(self):
        a = self._nova()
        self._nova(nome="B", whatsapp="(11) 98888-8888")
        crm.atualizar_conta(a.id, ContaUpdate(etapa="onboarding"), self.db, self.ana)
        f = crm.funil(db=self.db)
        contagem = {e.etapa: e.total for e in f.etapas}
        self.assertEqual(f.total, 2)
        self.assertEqual((contagem["lead"], contagem["onboarding"], contagem["bloqueado"]), (1, 1, 0))

    def test_atividade_e_ranking(self):
        c = self._nova()
        at = crm.registrar_atividade(
            c.id, AtividadeIn(tipo="Ligação", descricao="Falou com a Dra."), self.db, self.ana
        )
        self.assertEqual(at.tipo, "Ligação")
        crm.registrar_atividade(c.id, AtividadeIn(tipo="Visita"), self.db, self.bia)
        crm.registrar_atividade(c.id, AtividadeIn(tipo="Ligação"), self.db, self.bia)
        r = crm.ranking_atividades(db=self.db)
        self.assertEqual(r.total, 3)  # o registro de criação (sistema) não conta
        self.assertEqual(r.linhas[0].usuario, "Bia")
        self.assertEqual(r.linhas[0].por_tipo, {"Visita": 1, "Ligação": 1})
        self.assertIsNotNone(crm.detalhar_conta(c.id, self.db).ultima_atividade_em)

        with self.assertRaises(HTTPException):
            crm.registrar_atividade(c.id, AtividadeIn(tipo="Inventado"), self.db, self.ana)
        with self.assertRaises(HTTPException) as e:
            crm.excluir_atividade(at.id, self.db, self.bia)  # não é a autora
        self.assertEqual(e.exception.status_code, 403)
        crm.excluir_atividade(at.id, self.db, self.ana)
        self.assertIsNone(self.db.get(Atividade, at.id))
        sistema = self.db.scalar(select(Atividade).where(Atividade.tipo == "Sistema"))
        with self.assertRaises(HTTPException):
            crm.excluir_atividade(sistema.id, self.db, self.ana)


if __name__ == "__main__":
    unittest.main()
