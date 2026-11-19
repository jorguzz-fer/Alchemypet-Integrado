"""Formulário de Encaminhamento: pedidos, cópia do formulário e PDF."""
import io
import os
import unittest

os.environ.setdefault("DATABASE_URL", "sqlite://")

from fastapi import HTTPException  # noqa: E402
from pypdf import PdfReader  # noqa: E402
from sqlalchemy import create_engine, select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.database import Base  # noqa: E402
from app.models import CampoEncaminhamento, ExameEncaminhamento, Usuario  # noqa: E402
from app.routers import encaminhamentos as enc  # noqa: E402

DADOS = {
    "clinica": "CV Paiol - Penha", "data_coleta": "2026-11-17", "veterinario": "Dra. Manoela",
    "crmv": "SP-123", "responsavel": "Fernando Jorge", "paciente": "Thor", "especie": "canino",
    "genero": "m", "raca": "Golden", "idade_anos": "7", "motivo": "tratamento",
    "exame_urgente": True, "uso_medicamento": "sim", "medicamentos": "Doxiciclina",
}


class EncaminhamentoTest(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite://")
        Base.metadata.create_all(engine)
        self.db = Session(engine)
        enc.semear(self.db)
        self.u = Usuario(nome="Recepção", email="r@x.com", perfil="atendente")
        self.admin = Usuario(nome="Admin", email="a@x.com", perfil="admin")
        self.db.add_all([self.u, self.admin])
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def criar(self, dados=None, exames=("861", "422")):
        return enc.criar_pedido(enc.PedidoIn(dados=dados or DADOS, exames=list(exames)), self.db, self.u)

    def test_semeia_o_papel_uma_vez(self):
        f = enc.formulario(self.db)
        self.assertEqual(len(f.exames), 52)
        self.assertEqual(f.campos[0].chave, "clinica")
        enc.semear(self.db)  # de novo: não duplica
        self.assertEqual(len(enc.formulario(self.db).exames), 52)

    def test_cria_pedido_numerado_com_copia(self):
        p1, p2 = self.criar(), self.criar()
        self.assertEqual((p1.numero, p2.numero), (1, 2))
        self.assertTrue(p1.urgente)
        self.assertEqual(p1.dados["idade_anos"], 7)
        textos = {c["chave"]: c["texto"] for c in p1.campos}
        self.assertEqual(textos["especie"], "Canino")
        self.assertEqual(textos["data_coleta"], "17/11/2026")
        self.assertEqual([e["codigo"] for e in p1.exames], ["861", "422"])

    def test_listas_do_lis_e_codigos_no_pedido(self):
        f = enc.formulario(self.db)
        self.assertGreater(len(f.racas), 500)
        self.assertIn({"codigo": "222", "nome": "Golden Retriever"}, f.racas)
        p = self.criar({**DADOS, "raca": "golden retriever"})
        self.assertEqual((p.dados["especie_lis"], p.dados["raca_lis"]), ("1", "222"))
        p = self.criar({**DADOS, "especie": "outros", "especie_outro": "Coelho", "raca": "Mini Lop"})
        self.assertEqual((p.dados["especie_lis"], p.dados["raca_lis"]), ("116", "518"))
        p = self.criar({**DADOS, "raca": "Vira-lata caramelo"})  # fora da lista: só o nome
        self.assertNotIn("raca_lis", p.dados)

    def test_obrigatorios_e_campos_condicionais(self):
        with self.assertRaises(HTTPException) as e:
            self.criar({**DADOS, "paciente": "", "raca": ""})
        self.assertIn("Nome do paciente", e.exception.detail)
        # "Qual espécie?" só é exigido quando a espécie é Outros.
        with self.assertRaises(HTTPException) as e:
            self.criar({**DADOS, "especie": "outros"})
        self.assertIn("Qual espécie?", e.exception.detail)
        p = self.criar({**DADOS, "especie": "outros", "especie_outro": "Coelho"})
        self.assertEqual(p.dados["especie_outro"], "Coelho")
        # Valor de campo escondido não é guardado.
        p = self.criar({**DADOS, "uso_medicamento": "nao", "medicamentos": "x"})
        self.assertNotIn("medicamentos", p.dados)
        with self.assertRaises(HTTPException):
            self.criar(exames=())

    def test_formulario_muda_e_pedido_antigo_continua(self):
        antigo = self.criar()
        # A equipe acrescenta um campo e desativa um exame.
        enc.criar_campo(enc.CampoIn(chave="jejum", rotulo="Jejum (horas)", tipo="numero"), self.db)
        ex = self.db.scalar(select(ExameEncaminhamento).where(ExameEncaminhamento.codigo == "422"))
        enc.editar_exame(ex.id, enc.ExameIn(ativo=False), self.db)
        self.assertNotIn("422", [e.codigo for e in enc.formulario(self.db).exames])
        visto = enc.detalhar(antigo.id, self.db)
        self.assertEqual([e["codigo"] for e in visto.exames], ["861", "422"])
        novo = self.criar({**DADOS, "jejum": "12"}, exames=("861", "999"))
        self.assertEqual(novo.dados["jejum"], 12)
        self.assertEqual(novo.exames[1]["nome"], "Código do portfólio")
        # Campos do papel não podem ser excluídos.
        papel = self.db.scalar(select(CampoEncaminhamento).where(CampoEncaminhamento.chave == "cpf"))
        with self.assertRaises(HTTPException):
            enc.excluir_campo(papel.id, self.db)

    def test_pdf_do_formulario_com_pagina_extra(self):
        enc.criar_campo(enc.CampoIn(chave="jejum", rotulo="Jejum (horas)", tipo="numero"), self.db)
        p = self.criar({**DADOS, "jejum": "12"}, exames=("861", "555", "556", "557", "558"))
        resp = enc.baixar_pdf(p.id, self.db)
        pdf = PdfReader(io.BytesIO(resp.body))
        self.assertEqual(len(pdf.pages), 2)  # papel + "Informações adicionais"
        extra = pdf.pages[1].extract_text()
        self.assertIn("Jejum (horas)", extra)
        self.assertIn("558", extra)  # rodapé tem 3 quadrinhos; o 4º vai para a página extra
        self.assertIn("PEDIDO", pdf.pages[0].extract_text())

    def test_chegada_no_laboratorio(self):
        p = self.criar()
        from datetime import date
        p = enc.registrar_chegada(p.id, enc.LaboratorioIn(data_chegada=date(2026, 11, 18), n_amostras=2,
                                                          recebido_por="Triagem"), self.db)
        self.assertTrue(p.recebido)
        self.assertIn("recebido_por", [c["chave"] for c in p.campos])


if __name__ == "__main__":
    unittest.main()
