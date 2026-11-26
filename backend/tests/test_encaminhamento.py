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

    def criar(self, dados=None, exames=("424", "422")):
        return enc.criar_pedido(enc.PedidoIn(dados=dados or DADOS, exames=list(exames)), self.db, self.u)

    def test_semeia_o_papel_uma_vez(self):
        f = enc.formulario(self.db)
        self.assertEqual(len(f.exames), 345)
        self.assertEqual(f.campos[0].chave, "clinica")
        enc.semear(self.db)  # de novo: não duplica
        self.assertEqual(len(enc.formulario(self.db).exames), 345)

    def test_cria_pedido_numerado_com_copia(self):
        p1, p2 = self.criar(), self.criar()
        self.assertEqual((p1.numero, p2.numero), (1, 2))
        self.assertTrue(p1.urgente)
        self.assertEqual(p1.dados["idade_anos"], 7)
        textos = {c["chave"]: c["texto"] for c in p1.campos}
        self.assertEqual(textos["especie"], "Canino")
        self.assertEqual(textos["data_coleta"], "17/11/2026")
        self.assertEqual([e["codigo"] for e in p1.exames], ["424", "422"])

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

    def test_pedido_para_o_lis_e_marcar_lancado(self):
        p = self.criar({**DADOS, "raca": "golden retriever", "cpf": "305.129.528-09", "idade_meses": "3",
                        "suspeita": "Prurido"}, exames=("424", "170"))
        d = enc.pedido_para_lis(p.numero, self.db)
        self.assertEqual(d["numero_fmt"], "00000001")
        self.assertEqual(d["paciente"]["sexo"], "M")
        self.assertEqual((d["paciente"]["idade_anos"], d["paciente"]["idade_meses"]), (7, 3))
        self.assertEqual(d["paciente"]["especie"]["codigo"], "1")
        self.assertEqual(d["paciente"]["raca"], {"codigo": "222", "nome": "Golden Retriever"})
        self.assertEqual(d["responsavel"]["cpf"], "30512952809")
        self.assertEqual(d["solicitante"], {"nome": "Dra. Manoela", "crmv": "SP-123"})
        self.assertEqual([x["codigo"] for x in d["exames"]], ["424", "170"])
        self.assertIn("Pedido Alchemypet Nº 00000001", d["observacoes"])
        self.assertIn("EXAME URGENTE", d["observacoes"])
        self.assertIn("Medicamentos: Doxiciclina", d["observacoes"])
        with self.assertRaises(HTTPException):
            enc.pedido_para_lis(999, self.db)
        out = enc.marcar_lis(p.id, enc.LisIn(lancado=True), self.db, self.u)
        self.assertEqual(out.dados["lis_lancado_por"], "Recepção")
        self.assertTrue(out.lis)
        self.assertTrue(enc.listar(db=self.db, busca=None, data_de=None, data_ate=None, urgente=False,
                                   sort=None, dir=None, page=1, per_page=25).items[0].lis)
        self.assertEqual(enc.pedido_para_lis(p.numero, self.db)["lis"]["lancado_por"], "Recepção")
        out = enc.marcar_lis(p.id, enc.LisIn(lancado=False), self.db, self.u)
        self.assertFalse(out.lis)

    def test_zip_da_extensao_aponta_para_a_api(self):
        import json
        import zipfile
        from app.lis_integracao import zip_extensao
        z = zipfile.ZipFile(io.BytesIO(zip_extensao("https://api.exemplo.com.br/")))
        nomes = z.namelist()
        for arq in ("manifest.json", "background.js", "content.js", "config.js", "icone-128.png"):
            self.assertIn("alchemypet-lis/" + arq, nomes)
        m = json.loads(z.read("alchemypet-lis/manifest.json"))
        self.assertEqual(m["manifest_version"], 3)
        self.assertIn("https://api.exemplo.com.br/*", m["host_permissions"])
        self.assertNotIn("http://localhost:8000/*", m["host_permissions"])
        self.assertIn('"https://api.exemplo.com.br"', z.read("alchemypet-lis/config.js").decode())
        # Todo item com tipo e permissão (o Mac recusa o .zip sem isso).
        import stat
        for info in z.infolist():
            modo = info.external_attr >> 16
            if info.is_dir():
                self.assertTrue(stat.S_ISDIR(modo), info.filename)
            else:
                self.assertTrue(stat.S_ISREG(modo), info.filename)
                self.assertEqual(stat.S_IMODE(modo), 0o644, info.filename)

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
        self.assertEqual([e["codigo"] for e in visto.exames], ["424", "422"])
        novo = self.criar({**DADOS, "jejum": "12"}, exames=("424", "999"))
        self.assertEqual(novo.dados["jejum"], 12)
        self.assertEqual(novo.exames[1]["nome"], "Código do portfólio")
        # Campos do papel não podem ser excluídos.
        papel = self.db.scalar(select(CampoEncaminhamento).where(CampoEncaminhamento.chave == "cpf"))
        with self.assertRaises(HTTPException):
            enc.excluir_campo(papel.id, self.db)

    def test_pdf_do_formulario_com_pagina_extra(self):
        enc.criar_campo(enc.CampoIn(chave="jejum", rotulo="Jejum (horas)", tipo="numero"), self.db)
        p = self.criar({**DADOS, "jejum": "12"}, exames=("424", "90001", "90002", "90003", "90004"))
        resp = enc.baixar_pdf(p.id, self.db)
        pdf = PdfReader(io.BytesIO(resp.body))
        self.assertEqual(len(pdf.pages), 5)  # 4 páginas do impresso + "Informações adicionais"
        extra = pdf.pages[4].extract_text()
        self.assertIn("Jejum (horas)", extra)
        self.assertIn("90004", extra)  # rodapé tem 3 quadrinhos; o 4º vai para a página extra
        self.assertIn("PEDIDO", pdf.pages[0].extract_text())

    def test_catalogo_cabe_nas_colunas(self):
        # O SQLite não confere o tamanho das colunas; o Postgres recusa e a carga
        # inteira do formulário é desfeita (aconteceu com uma amostra de 42 letras).
        from app.encaminhamento_campos import CAMPOS
        from app.encaminhamento_catalogo import EXAMES
        for modelo, linhas in ((ExameEncaminhamento, EXAMES), (CampoEncaminhamento, CAMPOS)):
            for linha in linhas:
                for chave, valor in linha.items():
                    col = modelo.__table__.columns.get(chave)
                    tam = getattr(col.type, "length", None) if col is not None else None
                    if isinstance(valor, str) and tam:
                        self.assertLessEqual(len(valor), tam, f"{modelo.__tablename__}.{chave}: {valor!r}")

    def test_impresso_de_4_paginas(self):
        ativos = {c.chave for c in enc.formulario(self.db).campos}
        self.assertTrue({"categoria_plano", "guia_recoleta", "guia_material"} <= ativos)
        self.assertNotIn("paciente_id", ativos)
        f = enc.formulario(self.db)
        self.assertEqual(len([g for g in f.grupos if g.get("pagina") == 4]), 12)
        # 766 aparece em dois blocos da página 3 (Teste Rápido e Parasitologia)
        from app.encaminhamento_catalogo import POR_CODIGO
        self.assertEqual(len(POR_CODIGO["766"]["caixas"]), 3)

    def test_histologia_obrigatoria_so_com_exame_de_histo(self):
        self.criar(exames=("109",))  # bioquímica: não pede a seção de histologia
        with self.assertRaises(HTTPException) as e:
            self.criar(exames=("48",))  # oncohistopatológico
        self.assertIn("Localização", e.exception.detail)
        p = self.criar({**DADOS, "localizacao": "Mama M4", "caracteristicas": ["firme", "xx"],
                        "distribuicao_lesoes": [{"lado": "ventral", "x": 0.2, "y": 0.5}, {"x": "a"}]},
                       exames=("48",))
        self.assertEqual(p.dados["caracteristicas"], ["firme"])
        self.assertEqual(len(p.dados["distribuicao_lesoes"]), 1)

    def test_amostras_do_213(self):
        p = self.criar({**DADOS, "amostra_1": "19/11"}, exames=("109",))
        self.assertNotIn("amostra_1", p.dados)  # sem o 213, o campo não vale
        p = self.criar({**DADOS, "amostra_1": "19/11"}, exames=("213",))
        self.assertEqual(p.dados["amostra_1"], "19/11")

    def test_chegada_no_laboratorio(self):
        p = self.criar()
        from datetime import date
        p = enc.registrar_chegada(p.id, enc.LaboratorioIn(data_chegada=date(2026, 11, 18), n_amostras=2,
                                                          recebido_por="Triagem"), self.db)
        self.assertTrue(p.recebido)
        self.assertIn("recebido_por", [c["chave"] for c in p.campos])


if __name__ == "__main__":
    unittest.main()
