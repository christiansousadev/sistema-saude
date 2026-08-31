# ── stage 1: compilação de dependências ──────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /build

# libs de sistema necessárias para compilar Pillow e psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
        libjpeg-dev \
        libpng-dev \
        libtiff-dev \
        libwebp-dev \
        libopenjp2-7-dev \
        libmagic-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# instala pacotes em /install — será copiado para o stage final
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── stage 2: imagem de produção ───────────────────────────────────────────────
FROM python:3.12-slim AS runner

WORKDIR /app

# apenas as libs compartilhadas em runtime (sem -dev)
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        libjpeg62-turbo \
        libpng16-16 \
        libtiff6 \
        libwebp7 \
        libopenjp2-7 \
        libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# pacotes Python compilados no stage anterior
COPY --from=builder /install /usr/local

# usuário sem privilégios de root
RUN useradd --uid 1001 --no-create-home appuser \
    && mkdir -p /app/uploads \
    && chown -R appuser:appuser /app

# copia o código-fonte com ownership já correto
COPY --chown=appuser:appuser . .

USER appuser

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

EXPOSE 8000

# executa migrations e sobe o servidor
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1"]
