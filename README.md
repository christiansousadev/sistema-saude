# Sistema Saúde

> Plataforma web de rastreamento de saúde pessoal — evolução física, exames clínicos com extração automatizada via IA (local ou LLM), comparador visual antes/depois, calculadora metabólica, assistente conversacional e relatório médico consolidado.

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-blue?logo=github-actions)
![Tests](https://img.shields.io/badge/tests-19%20passed-success)
![License](https://img.shields.io/badge/license-MIT-blue)
![Python](https://img.shields.io/badge/python-3.12-3776AB?logo=python&logoColor=white)
![Node](https://img.shields.io/badge/node-20.x-339933?logo=node.js&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115.5-009688?logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16.2.9-000000?logo=next.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)

---

## Tech Stack

### Frontend
| Tecnologia | Versão | Função |
|---|---|---|
| Next.js | 16.2.9 | Framework React (App Router, `output: standalone`, Edge Middleware) |
| React | 19 | UI declarativa e componentes interativos |
| TypeScript | strict | Tipagem estrita ponta a ponta |
| Tailwind CSS | v4 | Estilização moderna e responsiva |
| Recharts | 3.8.1 | Gráficos de evolução (IMC/Peso, Colesterol) |
| Axios | latest | HTTP client com envio automático de cookies `HttpOnly` (`withCredentials`) |

### Backend
| Tecnologia | Versão | Função |
|---|---|---|
| FastAPI | 0.115.5 | API REST assíncrona (OpenAPI, lifespan, BackgroundTasks) |
| Python | 3.12 | Runtime |
| SQLAlchemy | 2.0.36 | ORM (`Mapped` columns, pool configurável) |
| Alembic | 1.14.0 | Migrations com suporte a PostgreSQL ENUMs |
| bcrypt | 4.2.1 | Hashing nativo de senhas |
| python-jose | 3.3.0 | JWT HS256 com access tokens de curta duração (15 min) |
| cryptography | 44.0.0 | Criptografia de chaves de API com Fernet + HKDF-SHA256 |
| slowapi | 0.1.9 | Rate limiting por IP no endpoint de login |
| python-magic | 0.4.x | Validação real de MIME types nos uploads |
| pdfplumber | 0.11.4 | Extração de texto de laudos em PDF |
| Pillow | 11.0.0 | Processamento e validação de imagens |
| OpenAI SDK | 1.57.0 | Compatível com OpenAI e Gemini via `base_url` |
| Pytest | 8.3.4 | Suíte completa de testes automatizados com banco isolado |

### Infra & CI/CD
| Tecnologia | Versão | Função |
|---|---|---|
| Docker | 24+ | Containerização multi-stage e usuários não-root |
| Docker Compose | v2 | Orquestração local com rede `internal: true` |
| PostgreSQL | 16-alpine | Banco de dados relacional com colunas JSONB indexadas |
| GitHub Actions | v4 | Pipeline de CI/CD para testes de backend e build de frontend |

---

## Arquitetura e Features

### Módulos principais

**Módulo Físico & Comparador Antes/Depois**
- Registra medições semanais (peso, % gordura, massa muscular) com upload de foto.
- A IA analisa a imagem de forma assíncrona em background e devolve estimativas corporais no campo `ai_analysis` (JSONB tipado).
- **Comparador Visual de Fotos (`PhotoComparisonModal`):** Permite selecionar duas fotos do histórico e comparar via **Slider Interativo com divisor arrastável** ou **Lado a Lado**, calculando deltas ($\Delta$ Peso, $\Delta$ % Gordura, $\Delta$ Massa Magra, $\Delta$ IMC e dias decorridos).

**Calculadora Metabólica (TMB & TDEE)**
- Calcula a Taxa Metabólica Basal (TMB) através da equação validada de **Mifflin-St Jeor** com base em peso, altura, idade e sexo.
- Estima o Gasto Energético Total Diário (TDEE) conforme o nível de atividade física (Sedentário a Muito Ativo).
- Recomenda metas calóricas diárias para **Emagrecimento (-400 kcal)**, **Manutenção** e **Hipertrofia (+300 kcal)**.

**Módulo Clínico & Alertas de Tendências**
- Upload de laudos laboratoriais (PDF ou imagem) com extração de até 16 biomarcadores em 7 categorias.
- **Motor de Tendências (`biomarker_trends`):** Calcula deltas percentuais ($\Delta\%$) entre exames consecutivos e gera alertas preventivos automáticos para variações relevantes (>15%).
- **Garantia Human-in-the-loop:** Todo exame inicia com `is_validated=False` e permite conferência/ajuste antes da validação final.

**Relatório Médico Consolidado em PDF (`/reports/medical-summary`)**
- Gera prontuário estruturado consolidando perfil do paciente, evolução física, histórico de exames laboratoriais, tabela de biomarcadores com referências e alertas clínicos ativos.
- Layout de alta resolução otimizado para impressão e exportação em PDF via `@media print`.

**Assistente de Saúde com IA (`HealthAssistantModal`)**
- Chat conversacional seguro contextualizado com o histórico recente de saúde do usuário.
- Suporta LLM configurada pelo usuário (OpenAI / Gemini) ou motor inteligente de regras locais caso nenhuma API key esteja cadastrada.

**Módulo de Segurança e Governança**
- JWT em cookies `HttpOnly; SameSite=Lax` (15 min) + refresh token rotation de 7 dias com detecção de reuso.
- Rate limiting no login (10 tentativas/min por IP).
- Criptografia de API keys com Fernet derivado por HKDF-SHA256.
- Endpoint autenticado `/uploads` com verificação de propriedade por `user_id` (prevenção total de IDOR e path traversal).
- Logs estruturados em JSON para auditoria (`audit.*`).

---

## Rotas da API (v1)

| Método | Rota | Autenticação | Descrição |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Pública | Registra novo usuário |
| POST | `/api/v1/auth/login` | Pública (rate limit: 10/min) | Emite JWT curto (15m) + refresh token (7d) |
| POST | `/api/v1/auth/refresh` | Cookie `ss_refresh_token` | Renova par de tokens (rotation com detecção de reuso) |
| GET | `/api/v1/auth/me` | Cookie `ss_access_token` | Dados do usuário autenticado |
| POST | `/api/v1/auth/logout` | Cookie | Revoga refresh token do banco e limpa cookies |
| GET | `/api/v1/physical/` | Cookie (limit max: 100) | Lista medições físicas com paginação |
| POST | `/api/v1/physical/` | Cookie | Salva medição e agenda análise de IA em background |
| GET | `/api/v1/physical/{id}` | Cookie | Detalhes da medição física |
| DELETE | `/api/v1/physical/{id}` | Cookie | Remove medição e arquivo associado |
| GET | `/api/v1/clinical/` | Cookie (limit max: 100) | Lista exames clínicos com paginação |
| POST | `/api/v1/clinical/` | Cookie | Cria exame e executa extração inicial |
| GET | `/api/v1/clinical/{id}` | Cookie | Detalhes do exame clínico |
| PATCH | `/api/v1/clinical/{id}/data` | Cookie | Validação manual (`is_validated = True`) |
| DELETE | `/api/v1/clinical/{id}` | Cookie | Remove exame e laudo original |
| GET | `/api/v1/reports/summary` | Cookie | Consolidado médico completo para prontuário/PDF |
| POST | `/api/v1/assistant/chat` | Cookie | Chat contextualizado com a assistente de IA |
| GET | `/api/v1/config/active` | Cookie | Configuração de IA ativa do usuário |
| POST | `/api/v1/config/` | Cookie | Salva/atualiza configuração de IA (criptografa key) |
| GET | `/health` | Pública | Healthcheck dos containers |
| GET | `/uploads/{subfolder}/{filename}` | Cookie + IDOR check | Acesso seguro a fotos e PDFs |

---

## Quick Start

### 1. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Preencha os campos obrigatórios no `.env`:
```env
# Gerar com: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=<chave-hex-64-caracteres>
POSTGRES_PASSWORD=<senha-segura>
```

### 2. Suba os containers com Docker Compose

```bash
docker compose up --build -d
```

| Serviço | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API (Swagger) | http://localhost:8000/docs |
| API (ReDoc) | http://localhost:8000/redoc |
| Healthcheck | http://localhost:8000/health |

---

## Testes Automatizados & Qualidade

O backend conta com **19 testes automatizados** utilizando `pytest` e banco SQLite in-memory:

```bash
# Executar suíte de testes do backend
cd backend
pytest tests/ -v
```

O frontend é validado com typecheck estrito do TypeScript:

```bash
# Executar build de produção do frontend
cd frontend
npm run build
```

---

## Roadmap

### Concluídos ✅
- [x] **Criptografia de chaves de API em repouso** (Fernet + HKDF-SHA256)
- [x] **Rate limiting** (`slowapi` 10 req/min por IP no login)
- [x] **Refresh token rotation** (Cookies HttpOnly, access token de 15m, detecção de reuso)
- [x] **Suíte de testes de integração e unitários** (`pytest`, 19 testes automatizados)
- [x] **Pipeline de CI/CD** (GitHub Actions para backend e frontend)
- [x] **Comparador Antes/Depois com Slider Interativo**
- [x] **Calculadora Metabólica (TMB Mifflin-St Jeor & TDEE)**
- [x] **Relatório Médico Consolidado em PDF**
- [x] **Assistente de Saúde com IA (Chat Contextualizado)**
- [x] **Alertas de Tendências de Biomarcadores**

### Futuros 📅
- [ ] **Object storage** (Migrar uploads de volume Docker para Cloudflare R2 / AWS S3)
- [ ] **Banco gerenciado em produção** (Supabase, Neon ou AWS RDS)
- [ ] **Observabilidade com Prometheus + Grafana**
- [ ] **Rotina de Backup Automatizado do Postgres**

---

## Estrutura do Monorepo

```
sistema-saude/
├── .github/
│   └── workflows/
│       └── ci.yml                    # Pipeline CI/CD (Pytest + Next.js Build)
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── endpoints/
│   │   │   │   ├── admin.py          # Gestão superadmin
│   │   │   │   ├── assistant.py      # Chat assistente IA
│   │   │   │   ├── auth.py           # Login, register, refresh, logout
│   │   │   │   ├── clinical.py       # Exames laboratoriais
│   │   │   │   ├── config.py         # Configuração de IA
│   │   │   │   ├── physical.py       # Evolução física
│   │   │   │   └── reports.py        # Relatório médico consolidado
│   │   │   └── router.py
│   │   ├── core/
│   │   │   ├── deps.py               # Dependency injection
│   │   │   └── security.py           # Bcrypt, JWT, Fernet HKDF
│   │   ├── db/
│   │   │   ├── models.py             # SQLAlchemy models (Mapped)
│   │   │   └── session.py            # Pool configurável
│   │   ├── schemas/                  # Pydantic schemas tipados
│   │   ├── services/
│   │   │   ├── ai_factory.py         # Orquestrador de IA (Local vs LLM)
│   │   │   ├── biomarker_trends.py   # Motor de deltas e tendências
│   │   │   ├── cv_service.py         # OCR e visão local
│   │   │   ├── llm_service.py        # OpenAI/Gemini vision
│   │   │   └── storage.py            # Uploads com validação MIME
│   │   ├── config.py
│   │   └── main.py
│   ├── tests/                        # Suíte de testes Pytest (19 testes)
│   │   ├── conftest.py               # Fixtures SQLite e TestClient
│   │   ├── test_auth_endpoints.py
│   │   ├── test_clinical_endpoints.py
│   │   ├── test_physical_endpoints.py
│   │   ├── test_reports_and_assistant.py
│   │   └── test_security.py
│   ├── alembic/                      # Migrations de banco de dados
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/               # /login, /register
│   │   │   ├── (protected)/
│   │   │   │   ├── admin/            # Painel superadmin
│   │   │   │   ├── clinical/         # Exames e manual-mapping
│   │   │   │   ├── dashboard/        # Painel com gráficos e TMB
│   │   │   │   ├── physical/         # Medições e comparador
│   │   │   │   ├── reports/          # /reports/medical-summary
│   │   │   │   └── settings/         # Configurações de IA
│   │   ├── components/
│   │   │   ├── charts/               # Recharts (IMC, Colesterol)
│   │   │   ├── layout/               # Navbar com atalhos
│   │   │   └── ui/                   # Modal Comparador, Assistente IA, MetabolicCard
│   │   ├── contexts/                 # AuthContext com silent refresh
│   │   ├── lib/                      # Services, hooks, utils
│   │   ├── middleware.ts             # Proteção server-side de rotas
│   │   └── types/                    # TypeScript interfaces
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── .env.example
├── auditoria_sistema.md              # Auditoria técnica e manual de operações
└── README.md
```

---

## Licença

MIT — consulte o arquivo `LICENSE` para detalhes.
