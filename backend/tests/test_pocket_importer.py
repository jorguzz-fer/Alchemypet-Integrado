"""Testes do importador do Pocket com dados fictícios.

Rodar: cd backend && python -m unittest discover -s tests
"""
import io
import os
import unittest

os.environ.setdefault("DATABASE_URL", "sqlite://")

from openpyxl import Workbook  # noqa: E402
from sqlalchemy import create_engine, select  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.database import Base  # noqa: E402
from app.models import Clinica, Portador, TransferenciaPortador  # noqa: E402
from app.pocket_importer import detectar_tipo, importar_arquivos, ler_tabela, norm_telefone  # noqa: E402


def csv_pocket(cab: list[str], linhas: list[list[str]], seta: bool = True) -> bytes:
    """Monta um CSV no formato de exportação do grid do Pocket."""
    pre_cab = ['""', '""', '"IIII"'] + (['""'] if seta else [])
    pre = ['""', '""', '"IIII"'] + (['" -->"'] if seta else [])
    out = [",".join(pre_cab + [f'"{c}"' for c in cab])]
    out += [",".join(pre + [f'"{c}"' for c in linha]) for linha in linhas]
    return ("\n".join(out) + "\n").encode()


def xlsx_pocket(cab: list[str], linhas: list[list]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.append(["Sistema Pocket"])
    ws.append(cab)
    for linha in linhas:
        ws.append(linha)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


CLINICAS = csv_pocket(
    ["Código", "Nome da clínica", "Região", "Responsável", "Whatsapp"],
    [
        ["10", "Clínica Alfa", "ZONA SUL", "", "(11) 91111-1111"],
        ["11", "Clínica Beta", "ABCD", "Dra. B", "(11) 92222-2222"],
        ["12", "Clínica Gama", "ZONA SUL", "", "(11) 93333-3333"],
    ],
)
COM_USO = xlsx_pocket(["Código", "Nome", "Região", "Qtd"], [[10, "Clínica Alfa", "ZONA SUL", 40]])
SEM_USO = xlsx_pocket(["Código", "Nome", "Região"], [[9001, "Clínica Beta", "ABCD"]])
LABS = csv_pocket(["Nome"], [["TECSA"], ["LAB VETEX"]])
LEADS = xlsx_pocket(
    ["Nome", "Telefone", "Email", "Captação", "Vendedor", "Cidade", "UF", "Decisor", "Atend. Mês",
     "Exames Mês", "Divide Lab", "Laboratorio", "Nota Lab", "Atende Convênio", "Convênio",
     "Onboarding", "Laboratórios"],
    [
        # casa com a Clínica Alfa pelo telefone
        ["Alfa (lead)", "(11)91111-1111", "alfa@x.com", "Google", "Roberta Lanelli", "SP", "SP",
         "Sim", 10, 5, "Sim", "Tecsa", "Bom", "Não", None, "25/04/2025", None],
        # casa com a Clínica Gama pelo nome
        ["clinica gama", None, None, "Mailing", "Pedro", None, None, None, None, None, None, None, None, None, None, None, None],
        # lead novo, repetido duas vezes
        ["Pet Novo", "(11)95555-5555", None, "Outros", "Ana", None, "SP", "Não", None, None, None,
         "Lab Vetex / Próprio", None, "Sim", "Petlove", None, None],
        ["#N/A", "#N/A", None, None, None, None, None, None, None, None, None, None, None, None, None, None, None],
        ["Pet Novo 2", "11 95555-5555", None, None, "Ana", None, None, None, None, None, None, None, None, None, None, None, None],
    ],
)
USUARIOS = csv_pocket(
    ["Id", "Login", "Departamento", "Cargo", "E-mail", "Telefone", "Tela inicial"],
    [["1", "10", "CLINICA", "CLINICA", "", "", "x"], ["2", "a@b.com", "PORTADOR", "PORTADOR", "", "", "x"]],
)
TRANSF = csv_pocket(
    ["Coleta", "Dt solicitação", "Portador", "Nome", "Portador destino", "Nome", "Aprovado por", "Data aprovação"],
    [
        ["100", "2026-10-27 16:57:34", "82", "PORTADOR A", "38", "PORTADOR B", "", ""],
        ["101", "2025-01-30 12:39:18", "38", "PORTADOR B", "", "", "supervisor.triagem", "2025-01-30"],
    ],
)

ARQUIVOS = [
    ("leads.xlsx", LEADS),  # fora de ordem de propósito
    ("clinicas.csv", CLINICAS),
    ("utilizacao.xlsx", COM_USO),
    ("sem_uso.xlsx", SEM_USO),
    ("laboratorios.csv", LABS),
    ("usuarios.csv", USUARIOS),
    ("transferencias.csv", TRANSF),
]


class PocketImporterTest(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite://")
        Base.metadata.create_all(engine)
        self.db = Session(engine)

    def tearDown(self):
        self.db.close()

    def test_leitura_e_deteccao(self):
        cab, linhas = ler_tabela("clinicas.csv", CLINICAS)
        self.assertEqual(cab[:2], ["Código", "Nome da clínica"])
        self.assertEqual(len(linhas), 3)
        self.assertEqual(detectar_tipo(cab), "clinicas")
        self.assertEqual(detectar_tipo(ler_tabela("u.xlsx", COM_USO)[0]), "utilizacao_com_uso")
        self.assertEqual(detectar_tipo(ler_tabela("s.xlsx", SEM_USO)[0]), "utilizacao_sem_uso")
        self.assertEqual(detectar_tipo(ler_tabela("l.xlsx", LEADS)[0]), "leads")
        self.assertEqual(detectar_tipo(ler_tabela("t.csv", TRANSF)[0]), "transferencias")
        self.assertEqual(detectar_tipo(["Qualquer", "Coisa"]), "")

    def test_telefone(self):
        self.assertEqual(norm_telefone("(11) 91111-1111"), "11911111111")
        self.assertEqual(norm_telefone("+55 11 91111-1111"), "11911111111")
        self.assertEqual(norm_telefone("1234"), "")

    def test_unifica_lead_e_clinica(self):
        importar_arquivos(self.db, ARQUIVOS)
        contas = {c.nome: c for c in self.db.scalars(select(Clinica))}
        # 3 clínicas + 1 lead novo (o repetido entra na mesma conta)
        self.assertEqual(len(contas), 4)

        alfa = contas["Clínica Alfa"]
        self.assertEqual(alfa.etapa, "cliente")
        self.assertEqual(alfa.vendedor, "Roberta Ianelli")  # grafia corrigida
        self.assertEqual(alfa.email, "alfa@x.com")
        self.assertTrue(alfa.decisor)
        self.assertTrue(alfa.em_uso)
        self.assertEqual(alfa.qtd_os_periodo, 40)
        self.assertTrue(alfa.tem_login_pocket)
        self.assertEqual(alfa.regiao.nome, "ZONA SUL")
        self.assertEqual([lab.nome for lab in alfa.laboratorios], ["TECSA"])

        self.assertIs(contas["Clínica Beta"].em_uso, False)  # sem uso, casado pelo nome
        self.assertIsNone(contas["Clínica Gama"].em_uso)
        self.assertEqual(contas["Clínica Gama"].captacao, "Mailing")

        novo = contas["Pet Novo"]
        self.assertEqual(novo.etapa, "lead")
        self.assertEqual(novo.origem, "lead")
        self.assertIs(novo.atende_convenio, True)
        self.assertEqual([lab.nome for lab in novo.laboratorios], ["LAB VETEX"])

        self.assertEqual(self.db.scalar(select(TransferenciaPortador).where(TransferenciaPortador.coleta == "101")).aprovado_por, "supervisor.triagem")
        self.assertEqual(len(self.db.scalars(select(Portador)).all()), 2)

    def test_reimportacao_nao_duplica(self):
        importar_arquivos(self.db, ARQUIVOS)
        res = importar_arquivos(self.db, ARQUIVOS)
        self.assertEqual(sum(r["criados"] for r in res), 0)
        self.assertEqual(len(self.db.scalars(select(Clinica)).all()), 4)
        self.assertEqual(len(self.db.scalars(select(TransferenciaPortador)).all()), 2)

    def test_lead_antes_da_clinica_vira_a_mesma_conta(self):
        importar_arquivos(self.db, [("leads.xlsx", LEADS)])
        importar_arquivos(self.db, [("clinicas.csv", CLINICAS)])
        alfa = self.db.scalars(select(Clinica).where(Clinica.codigo_pocket == "10")).all()
        self.assertEqual(len(alfa), 1)
        self.assertEqual(alfa[0].nome, "Clínica Alfa")
        self.assertEqual(alfa[0].vendedor, "Roberta Ianelli")

    def test_arquivo_desconhecido(self):
        res = importar_arquivos(self.db, [("x.csv", b"a,b\n1,2\n")])
        self.assertEqual(res[0]["tipo"], "")
        self.assertTrue(res[0]["avisos"])


if __name__ == "__main__":
    unittest.main()
