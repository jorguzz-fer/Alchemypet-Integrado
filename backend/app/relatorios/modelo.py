"""Modelo estruturado intermediário entre o .docx e o PDF diagramado.

O parser nunca devolve HTML: ele devolve estes blocos, e o renderizador
decide a aparência. Assim o layout pode mudar sem mexer na leitura do Word.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

# Status de um item de controle dentro de um setor.
# "ok" vira bolinha verde na matriz; "atencao" vira âmbar + etiqueta ATENÇÃO.
Situacao = Literal["ok", "atencao"]

TipoRelatorio = Literal["executivo", "completo"]


@dataclass
class ItemStatus:
    """Linha "Item | Status" do quadro de um setor."""

    rotulo: str
    texto: str
    situacao: Situacao = "ok"


@dataclass
class Setor:
    nome: str
    itens: list[ItemStatus] = field(default_factory=list)
    plano: list[str] = field(default_factory=list)

    @property
    def tem_atencao(self) -> bool:
        return any(i.situacao == "atencao" for i in self.itens)


# ----- Blocos de conteúdo (relatório completo) -----


@dataclass
class Paragrafo:
    texto: str
    destaque: bool = False  # parágrafo curto centralizado (ex.: "−1 DP ← MÉDIA → +1 DP")


@dataclass
class Lista:
    itens: list[str] = field(default_factory=list)
    colunas: int = 1  # 3 colunas para listas longas e curtas (ex.: analitos)


@dataclass
class Tabela:
    cabecalho: list[str] = field(default_factory=list)
    linhas: list[list[str]] = field(default_factory=list)
    compacta: bool = False  # células curtas centralizadas (matriz de recorrência)


@dataclass
class SubTitulo:
    texto: str


@dataclass
class CartaoMes:
    """Um mês do bloco "Resultados — Equipamento N"."""

    mes: str
    itens: list[str] = field(default_factory=list)


@dataclass
class GradeMeses:
    cartoes: list[CartaoMes] = field(default_factory=list)


@dataclass
class Destaque:
    """Caixa lateral (análise, troca de lote, encaminhamentos)."""

    titulo: str
    blocos: list["Bloco"] = field(default_factory=list)
    tom: Literal["roxo", "ouro"] = "roxo"


Bloco = Paragrafo | Lista | Tabela | SubTitulo | GradeMeses | Destaque


@dataclass
class Secao:
    """Seção numerada do relatório (01, 02, …)."""

    titulo: str
    blocos: list[Bloco] = field(default_factory=list)
    # Parte do sumário em que a seção entra (relatório completo).
    parte: str = ""


@dataclass
class Relatorio:
    tipo: TipoRelatorio = "executivo"
    titulo: str = "Controle da Qualidade"
    subtitulo: str = "Setores Laboratoriais"
    chapeu: str = "RELATÓRIO GERENCIAL"
    resumo: str = ""
    periodo: str = ""
    setores_contemplados: str = ""
    destinatario: str = "Diretoria"
    situacao_geral: str = ""
    documento: str = ""
    secoes: list[Secao] = field(default_factory=list)
    setores: list[Setor] = field(default_factory=list)

    @property
    def partes(self) -> list[tuple[str, list[Secao]]]:
        """Seções agrupadas por parte, preservando a ordem de leitura."""
        grupos: list[tuple[str, list[Secao]]] = []
        for s in self.secoes:
            if not grupos or grupos[-1][0] != s.parte:
                grupos.append((s.parte, []))
            grupos[-1][1].append(s)
        return grupos
