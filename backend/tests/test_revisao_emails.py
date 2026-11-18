"""Conclusão das revisões de resultado a partir da exportação do Gmail."""
import mailbox
import os
import tempfile
import unittest
import zipfile
from datetime import date
from email.message import EmailMessage
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "sqlite://")

from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.database import Base  # noqa: E402
from app.models import Chamado  # noqa: E402
from app.revisao_emails import classificar_resposta, processar_arquivo, sem_citacao  # noqa: E402
from app.routers import chamado as rota  # noqa: E402
from app.schemas import ChamadoUpdate  # noqa: E402

LAB = "atendimento@alchemypet.com.br"


def _msg(de, para, assunto, corpo, data, thrid=None):
    m = EmailMessage()
    m["From"], m["To"], m["Subject"], m["Date"] = de, para, assunto, data
    if thrid:
        m["X-GM-THRID"] = thrid
    m.set_content(corpo)
    return m


class ClassificarTest(unittest.TestCase):
    def test_frases(self):
        casos = {
            "Revisamos a amostra e o resultado está correto, conforme liberado.": "correto",
            "Identificamos um erro de digitação e o laudo foi retificado. Pedimos desculpas.": "erro_nosso",
            "Não houve erro na análise; repetimos e o resultado se manteve.": "correto",
            "Segue o laudo corrigido.": "erro_nosso",
            "Vamos verificar e retornamos em breve.": "nao_identificado",
            "O laudo não precisa ser corrigido, o resultado está correto.": "correto",
        }
        for texto, esperado in casos.items():
            self.assertEqual(classificar_resposta(texto)[0], esperado, texto)

    def test_trecho_mantem_acentos(self):
        _, trecho = classificar_resposta("Bom dia.\nO resultado está correto conforme liberado. Abraços")
        self.assertEqual(trecho, "O resultado está correto conforme liberado.")

    def test_citacao_removida(self):
        corpo = "Resultado confirmado.\n\nEm seg., 3 de jun. de 2024 às 10:00, Clínica <c@x.com> escreveu:\n> houve erro?"
        self.assertEqual(sem_citacao(corpo), "Resultado confirmado.")


class ImportacaoTest(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite://")
        Base.metadata.create_all(engine)
        self.db = Session(engine)
        thr = int("19be0d1234567890", 16)
        self.c_link = Chamado(chave="a", assunto="Revisão pedido 805296", motivo="Revisão de resultado",
                              link_gmail="https://mail.google.com/mail/u/0/#inbox/19be0d1234567890",
                              data=date(2026, 3, 2))
        self.c_assunto = Chamado(chave="b", assunto="811398 - Hemograma Thor", motivo="Revisão de resultado",
                                 link_gmail="https://mail.google.com/mail/u/0/#inbox/FMfcgzQXabc",
                                 data=date(2026, 3, 5))
        self.c_manual = Chamado(chave="c", assunto="Revisão 999", motivo="Revisão de resultado",
                                conclusao="correto", conclusao_origem="manual")
        self.c_sem = Chamado(chave="d", assunto="Algo sem e-mail", motivo="Revisão de resultado")
        self.c_outro = Chamado(chave="e", assunto="Pedido de tubos", motivo="Pedido de insumos")
        self.db.add_all([self.c_link, self.c_assunto, self.c_manual, self.c_sem, self.c_outro])
        self.db.commit()

        self.tmp = tempfile.TemporaryDirectory()
        caminho = Path(self.tmp.name) / "Revisao.mbox"
        mb = mailbox.mbox(str(caminho))
        mb.add(_msg("vet@clinica.com", LAB, "Revisão pedido 805296", "Podem revisar a ureia?",
                    "Mon, 2 Mar 2026 10:00:00 -0300", str(thr)))
        mb.add(_msg(LAB, "vet@clinica.com", "Re: Revisão pedido 805296",
                    "Olá! Identificamos um erro de digitação e o laudo foi retificado.\n\n"
                    "Em seg., 2 de mar., vet <vet@clinica.com> escreveu:\n> Podem revisar a ureia?",
                    "Mon, 2 Mar 2026 15:00:00 -0300", str(thr)))
        # Conversa interna (não conta como resposta à clínica).
        mb.add(_msg(LAB, "tecnico@alchemypet.com.br", "Fwd: 811398 - Hemograma Thor",
                    "Houve um erro? confere por favor", "Thu, 5 Mar 2026 09:00:00 -0300", "777"))
        mb.add(_msg("dra@petvida.com", LAB, "811398 - Hemograma Thor", "Plaquetas estranhas",
                    "Thu, 5 Mar 2026 08:00:00 -0300", "777"))
        mb.add(_msg(LAB, "dra@petvida.com", "RES: 811398 - Hemograma Thor",
                    "Repetimos a contagem e o resultado se manteve. Está correto conforme liberado.",
                    "Thu, 5 Mar 2026 11:00:00 -0300", "777"))
        mb.flush()
        mb.close()
        self.zip = Path(self.tmp.name) / "takeout.zip"
        with zipfile.ZipFile(self.zip, "w") as z:
            z.write(caminho, "Takeout/Mail/Revisao.mbox")

    def tearDown(self):
        self.db.close()
        self.tmp.cleanup()

    def test_importa_e_classifica(self):
        res = processar_arquivo(self.db, self.zip)
        self.assertEqual(res["revisoes"], 4)
        self.assertEqual(res["ligados"], 2)
        self.assertEqual(res["manuais"], 1)
        self.assertEqual(res["sem_email"], 1)
        self.db.refresh(self.c_link)
        self.db.refresh(self.c_assunto)
        self.assertEqual(self.c_link.conclusao, "erro_nosso")
        self.assertEqual(self.c_link.conclusao_origem, "email")
        self.assertIn("retificado", self.c_link.conclusao_trecho)
        self.assertEqual(self.c_link.texto, "Podem revisar a ureia?")
        self.assertEqual(self.c_assunto.conclusao, "correto")
        self.db.refresh(self.c_manual)
        self.assertEqual(self.c_manual.conclusao_origem, "manual")
        self.db.refresh(self.c_outro)
        self.assertEqual(self.c_outro.conclusao, "")

    def test_conversa_anotada_pelo_script(self):
        # O script do Google marca de qual chamado é a conversa (assunto do
        # e-mail diferente do da planilha).
        texto = (
            "From x@export Mon Mar 09 13:00:00 2026\n"
            "From: vet@clinica.com\nTo: atendimento@alchemypet.com.br\nSubject: Duvida no exame\n"
            "Date: Mon, 09 Mar 2026 13:00:00 GMT\nX-GM-THRID: 4242\n"
            "X-Alchemypet-Chamado: =?UTF-8?B?QWxnbyBzZW0gZS1tYWls?=\n\nPodem ver?\n\n"
            "From x@export Mon Mar 09 15:00:00 2026\n"
            "From: atendimento@alchemypet.com.br\nTo: vet@clinica.com\nSubject: Re: Duvida no exame\n"
            "Date: Mon, 09 Mar 2026 15:00:00 GMT\nX-GM-THRID: 4242\n"
            "X-Alchemypet-Chamado: =?UTF-8?B?QWxnbyBzZW0gZS1tYWls?=\n"
            "Content-Type: text/plain; charset=utf-8\nContent-Transfer-Encoding: 8bit\n\nO resultado está correto.\n\n"
        )
        caminho = Path(self.tmp.name) / "script.mbox"
        caminho.write_text(texto, encoding="utf-8")
        res = processar_arquivo(self.db, caminho)
        self.assertEqual(res["ligados"], 1)
        self.db.refresh(self.c_sem)
        self.assertEqual(self.c_sem.conclusao, "correto")

    def test_marcacao_manual_e_placar(self):
        processar_arquivo(self.db, self.zip)
        rota.atualizar(self.c_link.id, ChamadoUpdate(conclusao="correto"), self.db)
        self.db.refresh(self.c_link)
        self.assertEqual(self.c_link.conclusao_origem, "manual")
        # Nova importação não desfaz o que foi marcado à mão.
        processar_arquivo(self.db, self.zip)
        self.db.refresh(self.c_link)
        self.assertEqual(self.c_link.conclusao, "correto")
        p = rota.placar_revisao(motivo="Revisão de resultado", complexidade=None, status=None, busca=None,
                                data_de=None, data_ate=None, db=self.db)
        self.assertEqual((p.total, p.correto, p.erro_nosso, p.pendente), (4, 3, 0, 1))
        lista = rota.listar(motivo="Revisão de resultado", conclusao="pendente", complexidade=None,
                            status=None, busca=None, data_de=None, data_ate=None, ordem=None, sort=None,
                            dir=None, page=1, per_page=25, db=self.db)
        self.assertEqual([c.assunto for c in lista.items], ["Algo sem e-mail"])


if __name__ == "__main__":
    unittest.main()
