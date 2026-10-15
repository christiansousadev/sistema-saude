# Sistema Saúde

> Plataforma web de rastreamento de saúde pessoal — evolução física, exames clínicos com extração automatizada via IA (local ou LLM), comparador visual antes/depois, calculadora metabólica, assistente conversacional e relatório médico consolidado.

![Versão](https://img.shields.io/badge/version-v3.3.0-blue)
![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-blue?logo=github-actions)
![Tests](https://img.shields.io/badge/tests-36%20passed-success)
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
| React | 19 | UI declarativa e componentes interativos com `React.memo` |
| TypeScript | strict | Tipagem estrita ponta a ponta |
| Tailwind CSS | v4 | Estilização moderna e responsiva |
| Recharts | 3.8.1 | Gráficos de evolução carregados via `next/dynamic` (lazy loading) |
| React Hook Form | 7.79.0 | Gestão de formulários performática |
| Zod | 4.4.3 | Validação e inferência de schemas no cliente |
| Axios | latest | HTTP client com envio de cookies `HttpOnly` (`withCredentials`) |
| PWA & SW | Native | Suporte a Service Worker offline, Web App Manifest e Push Notifications |

### Backend
| Tecnologia | Versão | Função |
|---|---|---|
| FastAPI | 0.115.5 | API REST assíncrona (OpenAPI, lifespan, BackgroundTasks) |
| Python | 3.12 | Runtime |
| SQLAlchemy | 2.0.36 | ORM (`Mapped` columns, pool configurável) |
| Alembic | 1.14.0 | Migrations com suporte a PostgreSQL ENUMs |
| bcrypt | 4.2.1 | Hashing nativo de senhas e PINs de acesso médico |
| pyotp | 2.10.0 | Autenticação em Duas Etapas (2FA / TOTP) via authenticator app |
| python-jose | 3.3.0 | JWT HS256 com access tokens de curta duração (15 min) |
| cryptography | 44.0.0 | Criptografia de chaves de API com Fernet + HKDF-SHA256 |
| slowapi | 0.1.9 | Rate limiting por IP isolado em `limiter.py` (auth, IA e uploads) |
| python-magic | 0.4.x | Validação real de MIME types com rejeição estrita |
| pytesseract | 0.3.x | OCR local para imagens com suporte a português (`tesseract-ocr-por`) |
| pdfplumber | 0.11.4 | Extração de texto de laudos em PDF |
| Pillow | 11.0.0 | Processamento e validação de imagens |
| OpenAI SDK | 1.57.0 | Suporte a OpenAI/Gemini com timeout resiliente (30s) e retries (2) |
| Pytest | 8.3.4 | Suíte completa com 36 testes automatizados e banco isolado |

### Infra & CI/CD
| Tecnologia | Versão | Função |
|---|---|---|
| Docker | 24+ | Containerização multi-stage e usuários não-root (`appuser`) |
| Docker Compose | v2 | Orquestração local com rede `internal: true` |
| PostgreSQL | 16-alpine | Banco relacional com JSONB indexado |
| GitHub Actions | v4 | Pipeline de CI/CD para testes de backend e build do frontend |

---

## Arquitetura e Features

### Módulos principais

**Módulo Físico, Circunferências & Comparador Multi-Ângulo**
- Registra medições periódicas (peso, % gordura, massa muscular) e circunferências corporais completas (cintura, quadril, tórax, braço, coxa, pescoço).
- Cálculo automatizado de biométricas cardiovasculares: **Relação Cintura-Quadril (RCQ)** e **Relação Cintura-Estatura (RCEst)** com categorização de risco cardiovascular (Baixo, Moderado, Alto, Muito Alto).
- Upload seguro de fotos em múltiplos ângulos (Frente, Costas e Perfil).
- **Comparador Visual de Fotos (`PhotoComparisonModal`):** Permite selecionar duas avaliações e alternar entre os ângulos (Frente / Costas / Perfil) via **Slider Interativo com divisor arrastável** ou **Lado a Lado**, calculando deltas ($\Delta$ Peso, $\Delta$ % Gordura, $\Delta$ Massa Magra, $\Delta$ Cintura e dias decorridos).

**Calculadora Metabólica (TMB & TDEE)**
- Calcula a Taxa Metabólica Basal (TMB) através da equação validada de **Mifflin-St Jeor** com base em peso, altura, idade e sexo.
- Estima o Gasto Energético Total Diário (TDEE) conforme o nível de atividade física (Sedentário a Muito Ativo).
- Recomenda metas calóricas diárias para **Emagrecimento (-400 kcal)**, **Manutenção** e **Hipertrofia (+300 kcal)**.

**Módulo Clínico & Timeline Longitudinal de Biomarcadores**
- Upload de laudos laboratoriais (PDF ou imagem) com validação estrita de MIME e leitura em chunks até 10 MB com OCR local (**Tesseract**) ou **pdfplumber**.
- **Timeline Longitudinal Interativa (`BiomarkerEvolutionChart`):** Gráfico temporal com seletor de analitos (Colesterol, Glicemia, Creatinina, TSH, etc.), áreas sombreadas de referência clínica (mín/máx), detecção de tendências e alertas visuais.
- **Motor de Tendências (`biomarker_trends`):** Calcula deltas percentuais ($\Delta\%$) entre exames consecutivos e gera alertas preventivos automáticos para variações relevantes (>15%).
- **Garantia Human-in-the-loop:** Validação com schema tipado `ClinicalDataUpdate` exigindo dados completos antes de confirmar o exame.

**Registro Diário de Hábitos & Hidratação**
- Persistência estruturada no PostgreSQL (`DailyHabit`) com metas personalizadas de ingestão hídrica.
- Widget com incrementos rápidos (+250ml, +500ml), barra de progresso em tempo real e mini-gráfico de histórico dos últimos 7 dias.

**Inteligência Clínica & Farmacologia Integrada**
- **Resumo Executivo Unificado (`ExecutiveSummaryCard`):** Síntese holística gerada por IA (ou motor de regras local) cruzando evolução física, biomarcadores laboratoriais e consistência de hábitos com plano de ação semanal acionável.
- **Cruzamento Farmacológico com Biomarcadores (`medication_interactions`):** Motor clínico que correlaciona medicamentos e suplementos ativos com analitos laboratoriais (ex.: Creatina + Creatinina/eGFR, Estatinas + CPK/AST/ALT, Vitamina D + Cálcio, Ferro + Ferritina, Levotiroxina + TSH), emitindo alertas contextuais de monitoramento.
- **Preparador de Consultas Médicas (`DoctorQuestionsModal`):** Formula dúvidas assertivas priorizando interações medicamentosas e analitos alterados para guiar a consulta médica.
- **Assistente Conversacional (`HealthAssistantModal`):** Chat conversacional seguro contextualizado com o histórico recente de saúde e medicações.

**Gestão de Medicamentos & Suplementos**
- Acompanhamento contínuo de prescrições medicamentosas, suplementos alimentares e vitaminas com dosagens, frequências e horários.
- Controle de status (em uso vs. pausado) com categorização visual.

**Acesso Temporário com PIN para Médicos (`/share/[token]`) & Portabilidade LGPD**
- **Link de Acesso Médico com Proteção por PIN:** Compartilhamento somente-leitura do prontuário médico com prazos de expiração (24h a 30 dias), contador de acessos, revogação imediata e proteção opcional por PIN (4 a 8 dígitos) com hash `bcrypt`.
- **Página Pública do Prontuário (`/share/[token]`):** Interface com pré-checagem (`/share/{token}/check`) e tela de desbloqueio por PIN para acesso seguro de médicos convidados.
- **Portabilidade Total LGPD (Art. 18, V):** Exportação em 1 clique em arquivo compactado `.ZIP` contendo perfil do usuário em JSON, múltiplos arquivos CSV estruturados (físico, clínico, biomarcadores, hábitos, medicamentos) e termo legal de portabilidade.

**PWA & Notificações de Saúde**
- **Progressive Web App (PWA):** Instalação nativa em smartphone e desktop (`manifest.json` com modo standalone) e Service Worker (`sw.js`) para suporte a carregamento offline.
- **Web Push Notifications:** Lembretes proativos de hidratação e medicação através de notificações nativas do sistema operacional.

**Módulo de Segurança e Governança**
- **Autenticação em Duas Etapas (2FA / TOTP):** Proteção via aplicativos autenticadores (Google Authenticator, Authy, Microsoft Authenticator) com segredo base32, geração de QR Code e desafio de 6 dígitos no login.
- JWT em cookies `HttpOnly; SameSite=Lax` (15 min) + refresh token rotation de 7 dias com detecção e revogação de reuso.
- Rate limiting com `slowapi`: 10 req/min no login e 15 req/min nos endpoints de IA (`/assistant/chat`, `/clinical/`, `/physical/`).
- Proteção server-side com Edge Middleware em `/dashboard`, `/physical`, `/clinical`, `/reports`, `/settings` e `/admin` com suporte a `?redirect=` sanitizado.
- Mascaramento rigoroso de chaves de API na tela de configurações (`settings/page.tsx`), impedindo vazamento de credenciais no DOM.
- Criptografia de API keys com Fernet derivado por HKDF-SHA256.
- Endpoint `/uploads` com verificação de propriedade por `user_id` e deduplicação de autenticação (prevenção total de IDOR e path traversal).
- Logs estruturados em JSON para auditoria (`audit.*`).

---

## Rotas da API (v1)

| Método | Rota | Autenticação | Rate Limit | Descrição |
|---|---|---|---|---|
| POST | `/api/v1/auth/register` | Pública | — | Registra novo usuário |
| POST | `/api/v1/auth/login` | Pública | 10/min (IP) | Emite JWT curto (15m) + refresh token (7d) com suporte a desafio 2FA |
| POST | `/api/v1/auth/2fa/setup` | Cookie | — | Inicia configuração de 2FA gerando segredo e URI QR Code |
| POST | `/api/v1/auth/2fa/verify` | Cookie | — | Valida código de 6 dígitos e ativa o 2FA na conta |
| POST | `/api/v1/auth/2fa/disable` | Cookie | — | Desativa o 2FA mediante confirmação com código atual |
| POST | `/api/v1/auth/refresh` | Cookie `ss_refresh_token` | — | Renova par de tokens (rotation com detecção de reuso) |
| GET | `/api/v1/auth/me` | Cookie `ss_access_token` | — | Dados do usuário autenticado |
| POST | `/api/v1/auth/logout` | Cookie | — | Revoga refresh token do banco e limpa cookies |
| GET | `/api/v1/physical/` | Cookie (limit max: 100) | — | Lista medições físicas com paginação |
| POST | `/api/v1/physical/` | Cookie | 15/min (IP) | Salva medição e agenda análise de IA em background |
| GET | `/api/v1/physical/{id}` | Cookie | — | Detalhes da medição física (com isolamento IDOR) |
| DELETE | `/api/v1/physical/{id}` | Cookie | — | Remove medição e arquivo associado |
| GET | `/api/v1/clinical/` | Cookie (limit max: 100) | — | Lista exames clínicos com paginação |
| GET | `/api/v1/clinical/biomarkers/timeline` | Cookie | — | Timeline longitudinal agrupada com faixas de referência |
| POST | `/api/v1/clinical/` | Cookie | 15/min (IP) | Cria exame e executa extração inicial |
| GET | `/api/v1/clinical/{id}` | Cookie | — | Detalhes do exame clínico (com isolamento IDOR) |
| PATCH | `/api/v1/clinical/{id}/data` | Cookie | — | Validação manual estrita (`is_validated = True`) |
| DELETE | `/api/v1/clinical/{id}` | Cookie | — | Remove exame e laudo original |
| GET | `/api/v1/habits/daily/today` | Cookie | — | Consulta status de hidratação e hábitos do dia |
| POST | `/api/v1/habits/water/increment` | Cookie | — | Incrementa ingestão de água (+250ml, etc.) |
| POST | `/api/v1/habits/water/set` | Cookie | — | Define quantidade e meta exata de água |
| POST | `/api/v1/habits/water/reset` | Cookie | — | Zera consumo de água da data |
| GET | `/api/v1/habits/water/history` | Cookie | — | Histórico semanal de hidratação e médias |
| GET | `/api/v1/assistant/executive-summary` | Cookie | — | Resumo executivo unificado física + exames + hábitos |
| GET | `/api/v1/assistant/doctor-questions` | Cookie | — | Gerador inteligente de dúvidas priorizando farmacologia |
| POST | `/api/v1/assistant/chat` | Cookie | 15/min (IP) | Chat contextualizado com a assistente de IA |
| GET | `/api/v1/medications` | Cookie | — | Lista prescrições e suplementação contínua |
| POST | `/api/v1/medications` | Cookie | — | Cadastra novo medicamento ou suplemento |
| GET | `/api/v1/medications/{id}` | Cookie | — | Detalhes do medicamento cadastrado |
| PUT | `/api/v1/medications/{id}` | Cookie | — | Atualiza dosagem, frequência ou status ativo |
| DELETE | `/api/v1/medications/{id}` | Cookie | — | Remove medicamento do prontuário |
| POST | `/api/v1/doctor-share/generate` | Cookie | — | Gera token de acesso médico temporário (com PIN opcional) |
| GET | `/api/v1/doctor-share/tokens` | Cookie | — | Lista links de compartilhamento ativos/expirados |
| POST | `/api/v1/doctor-share/tokens/{id}/revoke` | Cookie | — | Revoga link de compartilhamento imediatamente |
| GET | `/api/v1/public/reports/share/{token}/check` | Pública | — | Checa expiração e necessidade de PIN sem expor dados |
| GET | `/api/v1/public/reports/share/{token}` | Pública (Token ± PIN) | — | Visualização do prontuário médico protegido por PIN |
| GET | `/api/v1/export/patient-data` | Cookie | — | Exportação completa de dados em .ZIP (LGPD Art. 18, V) |
| GET | `/api/v1/reports/summary` | Cookie | — | Consolidado médico otimizado para prontuário/PDF |
| GET | `/api/v1/config/active` | Cookie | — | Configuração de IA ativa do usuário (chave mascarada) |
| POST | `/api/v1/config/` | Cookie | — | Salva/atualiza configuração de IA (criptografa key) |
| DELETE | `/api/v1/config/{id}` | Cookie | — | Remove configuração de IA do usuário |
| GET | `/api/v1/admin/users/` | Superadmin | — | Lista todos os usuários e métricas |
| GET | `/api/v1/admin/users/{id}/config` | Superadmin | — | Configuração de IA de usuário específico |
| POST | `/api/v1/admin/users/{id}/config` | Superadmin | — | Atualiza configuração de IA de usuário específico |
| GET | `/health` | Pública | — | Healthcheck dos containers |
| GET | `/uploads/{subfolder}/{filename}` | Cookie + IDOR check | — | Acesso seguro a fotos e laudos PDF |

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

O backend conta com **26 testes automatizados** utilizando `pytest` e banco SQLite in-memory:

```bash
# Executar suíte de testes do backend
cd backend
pytest tests/ -v
```

A suíte cobre:
- **Segurança básica e criptografia:** Bcrypt nativo, expiração JWT, rejeição de token inválido, geração de refresh tokens/família e criptografia Fernet + HKDF-SHA256 (`test_security.py`).
- **Autenticação e fluxo de sessão:** Registro, e-mail duplicado, senha fraca, login, rotação de refresh token e logout limpa cookies (`test_auth_endpoints.py`).
- **Validação de uploads e arquivos:** Rejeição de extensão não permitida (415), rejeição de MIME mismatch (415) e corte antecipado de arquivos > 10MB (413) (`test_upload_validation.py`).
- **Segurança avançada e RBAC:** Bloqueio por rate limiting (429), reuso malicioso de refresh token já rotacionado (401), isolamento estrito IDOR entre usuários (404) e restrição de rotas Superadmin (403/200) (`test_security_hardening.py`).
- **Módulos de negócio:** CRUD físico, CRUD clínico, relatório médico consolidado e chat com assistente (`test_clinical_endpoints.py`, `test_physical_endpoints.py`, `test_reports_and_assistant.py`).

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
- [x] **Rate limiting distribuído** (`slowapi` em `limiter.py` para login, chat de IA e uploads)
- [x] **Refresh token rotation** (Cookies HttpOnly, access token de 15m, detecção de reuso)
- [x] **Hardening de uploads** (Leitura em chunks, limite estrito de 10MB e validação MIME)
- [x] **Suporte a OCR local completo** (`pytesseract` + `tesseract-ocr` para imagens)
- [x] **Suíte de testes de integração e unitários** (`pytest`, 26 testes automatizados com 100% de sucesso)
- [x] **Pipeline de CI/CD** (GitHub Actions para backend e frontend)
- [x] **Comparador Antes/Depois com Slider Interativo**
- [x] **Calculadora Metabólica (TMB Mifflin-St Jeor & TDEE)**
- [x] **Relatório Médico Consolidado em PDF com otimização de queries**
- [x] **Assistente de Saúde com IA (Chat Contextualizado com timeouts resilientes)**
- [x] **Alertas de Tendências de Biomarcadores**
- [x] **Performance Frontend** (Lazy loading de gráficos Recharts e memoização de listas)
- [x] **Navegação mobile responsiva com menu hambúrguer**

### Futuros 📅
- [ ] **Object storage** (Migrar uploads de volume Docker para Cloudflare R2 / AWS S3)
- [ ] **Fila persistente para IA** (Celery + Redis com suporte a retries duráveis)
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
│   │   │   │   ├── assistant.py      # Chat assistente IA (rate limited + timeout)
│   │   │   │   ├── auth.py           # Login, register, refresh, logout
│   │   │   │   ├── clinical.py       # Exames laboratoriais (rate limited)
│   │   │   │   ├── config.py         # Configuração de IA
│   │   │   │   ├── physical.py       # Evolução física (rate limited)
│   │   │   │   └── reports.py        # Relatório médico consolidado otimizado
│   │   │   └── router.py
│   │   ├── core/
│   │   │   ├── deps.py               # Injeção de dependências e resolve_user_from_token
│   │   │   ├── limiter.py            # Instância centralizada do rate limiter (slowapi)
│   │   │   └── security.py           # Bcrypt, JWT, Fernet HKDF
│   │   ├── db/
│   │   │   ├── models.py             # SQLAlchemy models (Mapped)
│   │   │   └── session.py            # Pool configurável
│   │   ├── schemas/                  # Pydantic schemas tipados
│   │   ├── services/
│   │   │   ├── ai_factory.py         # Orquestrador de IA (Local vs LLM)
│   │   │   ├── biomarker_trends.py   # Motor de deltas e tendências
│   │   │   ├── cv_service.py         # OCR local (tesseract) e visão
│   │   │   ├── llm_service.py        # OpenAI/Gemini com timeout resiliente
│   │   │   └── storage.py            # Uploads com validação MIME e corte de 10MB
│   │   ├── config.py
│   │   └── main.py                   # Lifespan, middlewares, uploads seguros
│   ├── tests/                        # Suíte de testes Pytest (26 testes)
│   │   ├── conftest.py               # Fixtures SQLite e TestClient
│   │   ├── test_auth_endpoints.py
│   │   ├── test_clinical_endpoints.py
│   │   ├── test_physical_endpoints.py
│   │   ├── test_reports_and_assistant.py
│   │   ├── test_security.py
│   │   ├── test_security_hardening.py  # Rate limit, reuso de refresh, IDOR e RBAC
│   │   └── test_upload_validation.py   # MIME mismatch, extensão e limite de tamanho
│   ├── alembic/                      # Migrations de banco de dados
│   ├── Dockerfile                    # Multi-stage com libmagic e tesseract-ocr
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/               # /login (com ?redirect=), /register
│   │   │   ├── (protected)/
│   │   │   │   ├── admin/            # Painel superadmin
│   │   │   │   ├── clinical/         # Exames (com NewExamForm isolado)
│   │   │   │   ├── dashboard/        # Painel com gráficos dinâmicos e TMB
│   │   │   │   ├── physical/         # Medições (com NewMeasurementForm isolado)
│   │   │   │   ├── reports/          # /reports/medical-summary protegido
│   │   │   │   └── settings/         # Configurações de IA (chaves mascaradas)
│   │   ├── components/
│   │   │   ├── charts/               # Recharts lazy loaded via next/dynamic
│   │   │   ├── layout/               # Navbar responsiva com menu hambúrguer
│   │   │   └── ui/                   # Modal Comparador, Assistente IA, MetabolicCard
│   │   ├── contexts/                 # AuthContext com refresh silencioso
│   │   ├── lib/
│   │   │   ├── constants/            # llm-providers.ts e biomarkers.ts
│   │   │   ├── hooks/                # usePagination seguro para React 19
│   │   │   ├── services/             # Chamadas de API desacopladas
│   │   │   └── utils.ts
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
