FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

# Bibliotecas de sistema do WeasyPrint (renderização dos PDFs dos relatórios
# gerenciais). As fontes do layout vão no próprio pacote, em app/relatorios/fonts.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b libfribidi0 \
        libjpeg62-turbo libopenjp2-7 libffi8 shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

# Porta configurável via env PORT (default 8000). Ajuste "Ports Exposes" do
# Coolify para 8000 para casar com o proxy.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
