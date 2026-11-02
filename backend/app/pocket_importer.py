"""Importação das exportações de grid do Sistema Pocket (CRM e logística).

Cada arquivo é reconhecido pelo cabeçalho, não pelo nome. A importação é
idempotente: reenviar o mesmo arquivo atualiza os registros sem duplicar.

Regras de unificação (lead e clínica são a mesma conta):
- clínica do Pocket casa pelo código do Pocket; se não houver, adota uma
  clínica das pendências com o mesmo código e o mesmo nome, ou um lead já
  importado com o mesmo telefone;
- lead casa com uma conta pelo telefone e, na falta dele, pelo nome; leads
  repetidos (mesmo telefone ou nome) viram uma conta só;
- dados de lead só preenchem campos vazios: o cadastro do Pocket prevalece.
"""
from __future__ import annotations

import csv
import hashlib
import io
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime

from openpyxl import load_workbook
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import (
    Clinica,
    ClinicaLaboratorio,
    Laboratorio,
    Portador,
    Regiao,
    TransferenciaPortador,
    Transportadora,
)

# Grafias diferentes do mesmo vendedor no Pocket.
VENDEDOR_ALIAS = {"roberta lanelli": "Roberta Ianelli"}

# Ordem de processamento: cadastros de referência antes das contas, e as
# clínicas antes de leads e relatórios que dependem delas.
ORDEM = [
    "regioes", "laboratorios", "transportadoras", "clinicas",
    "utilizacao_com_uso", "utilizacao_sem_uso", "leads", "usuarios",
    "transferencias", "produtos", "os",
]

ROTULO = {
    "regioes": "Regiões",
    "laboratorios": "Laboratórios concorrentes",
    "transportadoras": "Transportadoras",
    "clinicas": "Clínicas",
    "utilizacao_com_uso": "Clínicas em utilização (com uso)",
    "utilizacao_sem_uso": "Clínicas sem utilização",
    "leads": "Leads",
    "usuarios": "Usuários",
    "transferencias": "Transferência de portadores",
    "produtos": "Produtos",
    "os": "OS",
}


@dataclass
class Resultado:
    arquivo: str
    tipo: str = ""
    linhas: int = 0
    criados: int = 0
    atualizados: int = 0
    ignorados: int = 0
    avisos: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "arquivo": self.arquivo,
            "tipo": self.tipo,
            "rotulo": ROTULO.get(self.tipo, "Não reconhecido"),
            "linhas": self.linhas,
            "criados": self.criados,
            "atualizados": self.atualizados,
            "ignorados": self.ignorados,
            "avisos": self.avisos,
        }


# ---------------------------------------------------------------- helpers

def norm_texto(s: object) -> str:
    """minúsculas, sem acento, espaços colapsados (inclui NBSP)."""
    t = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", t).strip().lower()


def norm_telefone(s: object) -> str:
    """Só dígitos, sem o DDI 55; vazio se curto demais para ser um telefone."""
    d = re.sub(r"\D", "", str(s or ""))
    if len(d) > 11 and d.startswith("55"):
        d = d[2:]
    d = d[-11:]
    return d if len(d) >= 10 else ""


# Erros de fórmula exportados como texto pela planilha.
_LIXO = {"#N/A", "#REF!", "#VALUE!", "#NAME?", "#DIV/0!", "N/A"}


def _txt(v: object, limite: int) -> str:
    t = re.sub(r"\s+", " ", str(v if v is not None else "")).strip()
    return "" if t.upper() in _LIXO else t[:limite]


def _sim_nao(v: object) -> bool | None:
    t = norm_texto(v)
    if t in ("sim", "s"):
        return True
    if t in ("nao", "n"):
        return False
    return None


def _inteiro(v: object) -> int | None:
    if v is None or v == "":
        return None
    try:
        return int(float(str(v).replace(",", ".")))
    except ValueError:
        return None


def _data(v: object) -> date | None:
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    t = str(v or "").strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(t[:10], fmt).date()
        except ValueError:
            continue
    return None


def _datahora(v: object) -> datetime | None:
    t = str(v or "").strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(t, fmt)
        except ValueError:
            continue
    return None


def _hash(*partes: object) -> str:
    return hashlib.sha256("|".join(str(p) for p in partes).encode()).hexdigest()


def _vendedor(v: object) -> str:
    nome = _txt(v, 120)
    return VENDEDOR_ALIAS.get(norm_texto(nome), nome)


def _preencher(obj, campo: str, valor) -> bool:
    """Preenche só se o campo estiver vazio. Devolve True se mudou."""
    if valor in (None, ""):
        return False
    atual = getattr(obj, campo)
    if atual in (None, ""):
        setattr(obj, campo, valor)
        return True
    return False


# ------------------------------------------------------------ leitura

def ler_tabela(nome: str, conteudo: bytes) -> tuple[list[str], list[list]]:
    """Lê CSV ou XLSX exportado do Pocket e devolve (cabeçalho, linhas).

    CSV do Pocket: as primeiras colunas são de controle do grid
    ("", "", "IIII", " -->"). XLSX: a 1ª linha é o título "Sistema Pocket".
    """
    if nome.lower().endswith((".xlsx", ".xlsm")):
        wb = load_workbook(io.BytesIO(conteudo), read_only=True, data_only=True)
        rows = [list(r) for r in wb.worksheets[0].iter_rows(values_only=True)]
        wb.close()
        inicio = 0
        while inicio < len(rows) and sum(1 for c in rows[inicio] if c not in (None, "")) < 2:
            inicio += 1  # pula o título
        if inicio >= len(rows):
            return [], []
        cab = [_txt(c, 80) for c in rows[inicio]]
        while cab and not cab[-1]:
            cab.pop()
        corpo = [r[: len(cab)] + [None] * (len(cab) - len(r)) for r in rows[inicio + 1:] if any(c not in (None, "") for c in r)]
        return cab, corpo

    texto = conteudo.decode("utf-8-sig", errors="replace")
    rows = list(csv.reader(io.StringIO(texto)))
    if not rows:
        return [], []
    cab = rows[0]
    desloc = 0
    if "IIII" in cab:
        desloc = cab.index("IIII") + 1
        if desloc < len(cab) and cab[desloc] == "":
            desloc += 1  # coluna de seta " -->"
    cab = [_txt(c, 80) for c in cab[desloc:]]
    corpo = [r[desloc:] for r in rows[1:] if any(c.strip() for c in r[desloc:])]
    return cab, corpo


def detectar_tipo(cab: list[str]) -> str:
    s = {norm_texto(c) for c in cab}
    if {"os", "clinica"} <= s:
        return "os"
    if "portador destino" in s:
        return "transferencias"
    if {"login", "departamento"} <= s:
        return "usuarios"
    if {"captacao", "vendedor"} <= s:
        return "leads"
    if "nome da clinica" in s:
        return "clinicas"
    if {"codigo", "nome", "regiao", "qtd"} <= s:
        return "utilizacao_com_uso"
    if {"codigo", "nome", "regiao"} <= s:
        return "utilizacao_sem_uso"
    if "empresa" in s:
        return "transportadoras"
    if "preco de venda" in s:
        return "produtos"
    if s == {"regiao"}:
        return "regioes"
    if s == {"nome"}:
        return "laboratorios"
    return ""


# ----------------------------------------------------------- importador

class ImportadorPocket:
    def __init__(self, db: Session):
        self.db = db
        self._regioes: dict[str, Regiao] = {
            norm_texto(r.nome): r for r in db.scalars(select(Regiao))
        }
        self._labs: dict[str, Laboratorio] = {
            self._chave_lab(lab.nome): lab for lab in db.scalars(select(Laboratorio))
        }
        self._carregar_contas()

    def _carregar_contas(self) -> None:
        self.por_codigo: dict[str, Clinica] = {}
        self.por_tel: dict[str, Clinica] = {}
        self.por_nome: dict[str, Clinica] = {}
        self.por_lead: dict[str, Clinica] = {}
        # Clínicas antes de leads: no casamento, a clínica do cadastro prevalece.
        contas = self.db.scalars(select(Clinica).order_by(Clinica.created_at, Clinica.id)).all()
        for c in sorted(contas, key=lambda c: c.origem == "lead"):
            self._indexar(c)

    def _indexar(self, c: Clinica) -> None:
        if c.codigo_pocket:
            self.por_codigo[c.codigo_pocket] = c
        if c.telefone_norm:
            self.por_tel.setdefault(c.telefone_norm, c)
        if c.nome:
            self.por_nome.setdefault(norm_texto(c.nome), c)
        if c.lead_chave:
            self.por_lead[c.lead_chave] = c

    @staticmethod
    def _chave_lab(nome: str) -> str:
        return norm_texto(nome).replace(" ", "")

    def regiao(self, nome: object) -> Regiao | None:
        n = _txt(nome, 80)
        if not n:
            return None
        k = norm_texto(n)
        r = self._regioes.get(k)
        if r is None:
            r = Regiao(nome=n)
            self.db.add(r)
            self._regioes[k] = r
        return r

    # -------------------------------------------------- por tipo de arquivo

    def regioes(self, cab, linhas, res: Resultado) -> None:
        for linha in linhas:
            nome = _txt(linha[0], 80)
            if not nome:
                res.ignorados += 1
                continue
            if norm_texto(nome) in self._regioes:
                res.ignorados += 1
            else:
                self.regiao(nome)
                res.criados += 1

    def laboratorios(self, cab, linhas, res: Resultado) -> None:
        for linha in linhas:
            nome = _txt(linha[0], 120)
            k = self._chave_lab(nome)
            if not k or k in self._labs:
                res.ignorados += 1
                continue
            lab = Laboratorio(nome=nome)
            self.db.add(lab)
            self._labs[k] = lab
            res.criados += 1

    def transportadoras(self, cab, linhas, res: Resultado) -> None:
        idx = {norm_texto(c): i for i, c in enumerate(cab)}
        existentes = {norm_texto(t.nome): t for t in self.db.scalars(select(Transportadora))}
        for linha in linhas:
            nome = _txt(linha[idx["empresa"]], 120)
            if not nome:
                res.ignorados += 1
                continue
            email = _txt(linha[idx["e-mail"]], 160) if "e-mail" in idx else ""
            tel = _txt(linha[idx["telefone"]], 40) if "telefone" in idx else ""
            t = existentes.get(norm_texto(nome))
            if t is None:
                t = Transportadora(nome=nome, email=email, telefone=tel)
                self.db.add(t)
                existentes[norm_texto(nome)] = t
                res.criados += 1
            else:
                t.email, t.telefone = email or t.email, tel or t.telefone
                res.atualizados += 1

    def clinicas(self, cab, linhas, res: Resultado) -> None:
        idx = {norm_texto(c): i for i, c in enumerate(cab)}
        for linha in linhas:
            codigo = _txt(linha[idx["codigo"]], 20)
            nome = _txt(linha[idx["nome da clinica"]], 200)
            if not codigo or not nome:
                res.ignorados += 1
                continue
            whats = _txt(linha[idx["whatsapp"]], 40) if "whatsapp" in idx else ""
            tel = norm_telefone(whats)
            regiao = self.regiao(linha[idx["regiao"]]) if "regiao" in idx else None
            resp = _txt(linha[idx["responsavel"]], 160) if "responsavel" in idx else ""

            c = self.por_codigo.get(codigo)
            if c is None:
                # Clínica das pendências com o mesmo código e nome.
                cand = self.por_nome.get(norm_texto(nome))
                if cand is not None and not cand.codigo_pocket and cand.codigo == codigo:
                    c = cand
                # Lead importado antes da clínica, com o mesmo telefone.
                elif tel and (cand := self.por_tel.get(tel)) is not None and cand.origem == "lead" and not cand.codigo_pocket:
                    c = cand
            if c is None:
                c = Clinica(nome=nome, codigo=codigo, origem="pocket")
                self.db.add(c)
                res.criados += 1
            else:
                res.atualizados += 1
                if c.origem == "lead":
                    c.origem = "pocket"
                    c.nome = nome
            c.codigo_pocket = codigo
            if not c.codigo:
                c.codigo = codigo
            c.etapa = "cliente"
            c.regiao = regiao or c.regiao
            if whats:
                c.whatsapp, c.telefone_norm = whats, tel
            if resp:
                c.responsavel = resp
            self._indexar(c)

    def utilizacao_com_uso(self, cab, linhas, res: Resultado) -> None:
        idx = {norm_texto(c): i for i, c in enumerate(cab)}
        for linha in linhas:
            codigo = _txt(linha[idx["codigo"]], 20)
            c = self.por_codigo.get(codigo)
            if c is None:
                res.ignorados += 1
                continue
            c.em_uso = True
            c.qtd_os_periodo = _inteiro(linha[idx["qtd"]]) or 0
            res.atualizados += 1
        if res.ignorados:
            res.avisos.append(
                f"{res.ignorados} código(s) sem clínica correspondente — importe antes o cadastro de clínicas."
            )

    def utilizacao_sem_uso(self, cab, linhas, res: Resultado) -> None:
        # Este relatório traz outro identificador no lugar do código da
        # clínica; o casamento é pelo nome, só entre clínicas do Pocket.
        idx = {norm_texto(c): i for i, c in enumerate(cab)}
        por_nome = {norm_texto(c.nome): c for c in self.por_codigo.values()}
        for linha in linhas:
            c = por_nome.get(norm_texto(linha[idx["nome"]]))
            if c is None or c.em_uso:
                res.ignorados += 1
                continue
            c.em_uso = False
            c.qtd_os_periodo = 0
            res.atualizados += 1
        res.avisos.append("Relatório sem código da clínica: casamento feito pelo nome.")

    def leads(self, cab, linhas, res: Resultado) -> None:
        idx = {norm_texto(c): i for i, c in enumerate(cab)}

        def g(linha, campo):
            i = idx.get(campo)
            return linha[i] if i is not None and i < len(linha) else None

        com_clinica = com_lead = 0
        labs_casados = 0
        for linha in linhas:
            nome = _txt(g(linha, "nome"), 200)
            tel_bruto = _txt(g(linha, "telefone"), 40)
            tel = norm_telefone(tel_bruto)
            if not nome and not tel:
                res.ignorados += 1
                continue
            # Clínica do cadastro primeiro (telefone, depois nome); só então
            # outro lead — assim a reimportação chega sempre à mesma conta.
            candidatos = [
                x for x in (
                    self.por_tel.get(tel) if tel else None,
                    self.por_nome.get(norm_texto(nome)) if nome else None,
                ) if x is not None
            ]
            c = next((x for x in candidatos if x.origem != "lead"), None) or (
                candidatos[0] if candidatos else None
            )
            if c is None:
                chave = _hash("lead", tel or norm_texto(nome))
                c = self.por_lead.get(chave)
            if c is None:
                c = Clinica(nome=nome or tel_bruto, origem="lead", etapa="lead", lead_chave=chave)
                self.db.add(c)
                res.criados += 1
            else:
                res.atualizados += 1
                if c.origem == "lead":
                    com_lead += 1
                else:
                    com_clinica += 1
            if not c.etapa:
                c.etapa = "lead"
            if tel and not c.telefone_norm:
                c.whatsapp, c.telefone_norm = tel_bruto, tel
            _preencher(c, "email", _txt(g(linha, "email"), 200))
            _preencher(c, "cidade", _txt(g(linha, "cidade"), 120))
            _preencher(c, "uf", _txt(g(linha, "uf"), 2).upper())
            _preencher(c, "vendedor", _vendedor(g(linha, "vendedor")))
            _preencher(c, "captacao", _txt(g(linha, "captacao"), 60))
            _preencher(c, "decisor", _sim_nao(g(linha, "decisor")))
            _preencher(c, "atendimentos_mes", _inteiro(g(linha, "atend. mes")))
            _preencher(c, "exames_mes", _inteiro(g(linha, "exames mes")))
            _preencher(c, "divide_laboratorio", _sim_nao(g(linha, "divide lab")))
            _preencher(c, "nota_laboratorio", _txt(g(linha, "nota lab"), 20))
            _preencher(c, "convenios", _txt(g(linha, "convenio"), 500))
            _preencher(c, "onboarding_em", _data(g(linha, "onboarding")))
            conv = _sim_nao(g(linha, "atende convenio"))
            if conv is not None and c.origem == "lead":
                c.atende_convenio = conv
            texto_labs = " / ".join(
                t for t in (_txt(g(linha, "laboratorio"), 300), _txt(g(linha, "laboratorios"), 300)) if t
            )
            if texto_labs:
                _preencher(c, "laboratorios_texto", texto_labs)
                labs_casados += self._vincular_labs(c, texto_labs)
            self._indexar(c)
        res.avisos.append(
            f"{com_clinica} lead(s) casaram com uma clínica (telefone ou nome) e viraram a mesma conta; "
            f"{com_lead} juntaram-se a um lead já existente (repetidos ou reimportação)."
        )
        if labs_casados:
            res.avisos.append(f"{labs_casados} vínculo(s) com laboratórios concorrentes do cadastro.")
        res.avisos.append(
            "A etapa do funil não vem nesta exportação: leads entram como 'lead' e clínicas como 'cliente'."
        )

    def _vincular_labs(self, c: Clinica, texto: str) -> int:
        novos = 0
        for parte in re.split(r"[,;/+]| e ", texto):
            lab = self._labs.get(self._chave_lab(parte))
            if lab is not None and lab not in c.laboratorios:
                c.laboratorios.append(lab)
                novos += 1
        return novos

    def usuarios(self, cab, linhas, res: Resultado) -> None:
        # Só marca as clínicas que têm login; nenhum acesso é criado aqui.
        idx = {norm_texto(c): i for i, c in enumerate(cab)}
        deptos: dict[str, int] = {}
        for linha in linhas:
            depto = _txt(linha[idx["departamento"]], 40).upper()
            deptos[depto] = deptos.get(depto, 0) + 1
            if depto == "CLINICA":
                c = self.por_codigo.get(_txt(linha[idx["login"]], 20))
                if c is not None and not c.tem_login_pocket:
                    c.tem_login_pocket = True
                    res.atualizados += 1
                elif c is None:
                    res.ignorados += 1
            else:
                res.ignorados += 1
        resumo = ", ".join(f"{k or '—'}: {v}" for k, v in sorted(deptos.items(), key=lambda x: -x[1]))
        res.avisos.append(f"Usuários por departamento — {resumo}. Nenhum login foi criado no Integrado.")

    def transferencias(self, cab, linhas, res: Resultado) -> None:
        # Colunas fixas: Coleta, Dt solicitação, Portador, Nome, Portador destino,
        # Nome, Aprovado por, Data aprovação (o nome se repete no cabeçalho).
        portadores = {p.codigo_pocket: p for p in self.db.scalars(select(Portador)) if p.codigo_pocket}
        chaves = set(self.db.scalars(select(TransferenciaPortador.chave)))

        def portador(cod: str, nome: str) -> Portador | None:
            cod = _txt(cod, 20)
            if not cod:
                return None
            p = portadores.get(cod)
            if p is None:
                p = Portador(codigo_pocket=cod, nome=_txt(nome, 160))
                self.db.add(p)
                portadores[cod] = p
            elif nome and not p.nome:
                p.nome = _txt(nome, 160)
            return p

        for linha in linhas:
            linha = list(linha) + [""] * (8 - len(linha))
            coleta, dt, de_cod, de_nome, para_cod, para_nome, aprov, aprov_em = linha[:8]
            if not _txt(coleta, 20):
                res.ignorados += 1
                continue
            chave = _hash("transf", coleta, dt, de_cod, para_cod)
            de, para = portador(de_cod, de_nome), portador(para_cod, para_nome)
            if chave in chaves:
                res.ignorados += 1
                continue
            self.db.add(TransferenciaPortador(
                chave=chave,
                coleta=_txt(coleta, 20),
                solicitado_em=_datahora(dt),
                de_portador=de,
                para_portador=para,
                aprovado_por=_txt(aprov, 80),
                aprovado_em=_data(aprov_em),
            ))
            chaves.add(chave)
            res.criados += 1

    def produtos(self, cab, linhas, res: Resultado) -> None:
        res.ignorados = len(linhas)
        res.avisos.append("Cadastro de produtos sem uso no Pocket (preços zerados): não importado.")

    def os(self, cab, linhas, res: Resultado) -> None:
        res.ignorados = len(linhas)
        res.avisos.append(
            "OS ainda não são importadas: a exportação não traz datas nem status. "
            "Envie a exportação completa com o histórico (pendência P-D1)."
        )


def importar_arquivos(db: Session, arquivos: list[tuple[str, bytes]]) -> list[dict]:
    """Importa vários arquivos numa transação, na ordem de dependência."""
    lidos = []
    resultados: list[Resultado] = []
    for nome, conteudo in arquivos:
        res = Resultado(arquivo=nome)
        try:
            cab, linhas = ler_tabela(nome, conteudo)
        except Exception as exc:  # noqa: BLE001
            res.avisos.append(f"Não foi possível ler o arquivo: {exc}")
            resultados.append(res)
            continue
        res.tipo = detectar_tipo(cab)
        res.linhas = len(linhas)
        if not res.tipo:
            res.avisos.append("Cabeçalho não reconhecido como exportação do Pocket.")
            resultados.append(res)
            continue
        lidos.append((res, cab, linhas))
        resultados.append(res)

    imp = ImportadorPocket(db)
    for res, cab, linhas in sorted(lidos, key=lambda x: ORDEM.index(x[0].tipo)):
        getattr(imp, res.tipo)(cab, linhas, res)
        db.flush()
    db.commit()
    return [r.as_dict() for r in resultados]
