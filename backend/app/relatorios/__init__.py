"""Geração dos Relatórios Gerenciais de Qualidade a partir dos .docx.

Fluxo: .docx enviado pela Qualidade → `parser_docx.ler_docx` monta o modelo
estruturado → `render.gerar_pdf` aplica o layout institucional (WeasyPrint).
"""
from .modelo import Relatorio
from .parser_docx import ler_docx
from .render import gerar_pdf

__all__ = ["Relatorio", "ler_docx", "gerar_pdf"]
