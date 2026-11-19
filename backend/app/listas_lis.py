"""Listas de espécies e raças do LIS (laborlis), com o código de cada uma.

Vêm das telas de configuração do LIS (exportadas para planilha). O
formulário usa para sugerir o nome enquanto o veterinário digita; o pedido
guarda o nome e, quando casa com a lista, o código do LIS (para integração).
Nomes repetidos com códigos diferentes no LIS aparecem uma vez só (vale o
primeiro código da lista).
"""
import unicodedata
from functools import lru_cache
from pathlib import Path

PASTA = Path(__file__).parent / "dados"


def chave(nome: str) -> str:
    s = "".join(c for c in unicodedata.normalize("NFD", nome or "") if unicodedata.category(c) != "Mn")
    return " ".join(s.lower().split())


@lru_cache
def _ler(arquivo: str) -> tuple[tuple[str, str], ...]:
    vistos, out = set(), []
    for linha in (PASTA / arquivo).read_text(encoding="utf-8").splitlines():
        if ";" not in linha:
            continue
        codigo, nome = (x.strip() for x in linha.split(";", 1))
        if not nome or chave(nome) in vistos:
            continue
        vistos.add(chave(nome))
        out.append((codigo, nome))
    return tuple(sorted(out, key=lambda x: chave(x[1])))


def racas() -> list[dict]:
    return [{"codigo": c, "nome": n} for c, n in _ler("racas_lis.txt")]


def especies() -> list[dict]:
    return [{"codigo": c, "nome": n} for c, n in _ler("especies_lis.txt")]


def codigo(lista: str, nome: str) -> str:
    """Código do LIS para o nome (sem diferenciar acento/maiúscula), ou ''."""
    alvo = chave(nome)
    for c, n in _ler(f"{lista}_lis.txt"):
        if chave(n) == alvo:
            return c
    return ""
