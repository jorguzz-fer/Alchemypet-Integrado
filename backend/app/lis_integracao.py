"""Lançamento do pedido no LIS (LaborLIS) pela extensão do navegador.

O LaborLIS não tem API: a extensão do Chrome (pasta `extensao_lis`) preenche
as telas dele com os dados do pedido. Aqui ficam:

- `dados_para_lis`: o pedido no formato que a extensão usa (já separado por
  campo da tela do LIS, com os códigos de espécie e raça do LIS);
- `zip_extensao`: a extensão pronta para instalar, já apontando para esta API.
"""
import io
import json
import re
import zipfile
from pathlib import Path

from . import listas_lis
from .models import Encaminhamento

PASTA_EXTENSAO = Path(__file__).parent / "extensao_lis"
# Endereços do LIS onde a extensão funciona.
LIS_URLS = ["https://*.laborlis.online/*"]
VERSAO_EXTENSAO = "1.1.0"


def _texto(e: Encaminhamento, chave: str) -> str:
    """Valor como foi mostrado no pedido (rótulo da opção, data dd/mm/aaaa...)."""
    for c in e.campos or []:
        if c.get("chave") == chave:
            return str(c.get("texto") or "").strip()
    v = (e.dados or {}).get(chave)
    return "" if v in (None, False) else str(v).strip()


def _nome_lis(lista: str, codigo: str) -> str:
    fonte = listas_lis.especies() if lista == "especies" else listas_lis.racas()
    return next((x["nome"] for x in fonte if x["codigo"] == codigo), "")


def dados_para_lis(e: Encaminhamento) -> dict:
    d = e.dados or {}
    especie_cod = str(d.get("especie_lis") or "")
    raca_cod = str(d.get("raca_lis") or "")
    especie = _nome_lis("especies", especie_cod) if especie_cod else ""
    especie = especie or _texto(e, "especie_outro") or _texto(e, "especie")
    raca = _nome_lis("racas", raca_cod) if raca_cod else ""
    raca = raca or _texto(e, "raca")

    def inteiro(chave):
        try:
            return int(str(d.get(chave) or "").strip())
        except ValueError:
            return None

    numero = f"{e.numero:08d}"
    suspeita = _texto(e, "suspeita")
    medicamentos = _texto(e, "medicamentos") if d.get("uso_medicamento") == "sim" else ""
    # Observações da guia: o que ajuda quem recebe a amostra.
    obs = [f"Pedido Alchemypet Nº {numero}"]
    if e.urgente:
        obs.append("EXAME URGENTE")
    if d.get("fast_track"):
        obs.append("Fast Track")
    if d.get("recoleta"):
        guia = _texto(e, "guia_recoleta")
        obs.append("Recoleta" + (f" (guia {guia})" if guia else ""))
    if d.get("material_faltante"):
        guia = _texto(e, "guia_material")
        obs.append("Material faltante" + (f" (guia {guia})" if guia else ""))
    if e.clinica:
        obs.append(f"Clínica: {e.clinica}")
    if suspeita:
        obs.append(f"Suspeita clínica: {suspeita}")
    if medicamentos:
        obs.append(f"Medicamentos: {medicamentos}")
    if loc := _texto(e, "localizacao"):
        obs.append(f"Localização: {loc}")

    return {
        "id": e.id,
        "numero": e.numero,
        "numero_fmt": numero,
        "clinica": e.clinica,
        "data_coleta": e.data_coleta.strftime("%d/%m/%Y") if e.data_coleta else "",
        "urgente": bool(e.urgente),
        "paciente": {
            "nome": e.paciente,
            "sexo": {"m": "M", "f": "F"}.get(str(d.get("genero") or ""), ""),
            "idade_anos": inteiro("idade_anos"),
            "idade_meses": inteiro("idade_meses"),
            "especie": {"codigo": especie_cod, "nome": especie},
            "raca": {"codigo": raca_cod, "nome": raca},
        },
        "responsavel": {"nome": e.responsavel, "cpf": re.sub(r"\D", "", _texto(e, "cpf"))},
        "solicitante": {"nome": e.veterinario, "crmv": _texto(e, "crmv")},
        "plano": {"nome": _texto(e, "plano_saude"), "matricula": _texto(e, "matricula")},
        "suspeita": suspeita,
        "medicamentos": medicamentos,
        "observacoes": "\n".join(obs),
        "exames": [{"codigo": x.get("codigo", ""), "nome": x.get("nome", "")} for x in e.exames or []],
        "lis": {"lancado_em": d.get("lis_lancado_em") or "", "lancado_por": d.get("lis_lancado_por") or ""},
    }


def zip_extensao(api_url: str) -> bytes:
    """A extensão em .zip, com o endereço desta API gravado nela."""
    api = api_url.rstrip("/")
    manifesto = json.loads((PASTA_EXTENSAO / "manifest.json").read_text(encoding="utf-8"))
    manifesto["version"] = VERSAO_EXTENSAO
    manifesto["host_permissions"] = [f"{api}/*", *LIS_URLS]
    manifesto["content_scripts"][0]["matches"] = LIS_URLS
    def entrada(nome: str, pasta: bool = False) -> zipfile.ZipInfo:
        # Permissões completas (tipo + modo): sem o tipo, o Utilitário de
        # Compressão do Mac recusa o .zip (erro 513).
        info = zipfile.ZipInfo(nome, date_time=(2026, 1, 1, 0, 0, 0))
        info.create_system = 3  # Unix
        info.external_attr = ((0o040755 if pasta else 0o100644) << 16) | (0x10 if pasta else 0)
        info.compress_type = zipfile.ZIP_STORED if pasta else zipfile.ZIP_DEFLATED
        return info

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr(entrada("alchemypet-lis/", pasta=True), b"")
        for arq in sorted(PASTA_EXTENSAO.rglob("*")):
            if not arq.is_file() or arq.name.startswith("."):
                continue
            nome = "alchemypet-lis/" + arq.relative_to(PASTA_EXTENSAO).as_posix()
            if arq.name == "manifest.json":
                conteudo = json.dumps(manifesto, ensure_ascii=False, indent=2).encode("utf-8")
            elif arq.name == "config.js":
                conteudo = f"// Gerado no download.\nself.ALCHEMYPET_API = {json.dumps(api)};\n".encode("utf-8")
            else:
                conteudo = arq.read_bytes()
            z.writestr(entrada(nome), conteudo)
    return buf.getvalue()
