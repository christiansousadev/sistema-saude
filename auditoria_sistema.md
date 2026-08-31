# Auditoria Técnica e Manual de Operações — Sistema Saúde

**Versão:** 3.1.0  
**Data de emissão:** 2026-08-31  
**Classificação:** Interno — Engenharia e Governança de TI  
**Escopo:** Monorepo `sistema-saude` (backend FastAPI + frontend Next.js + infraestrutura Docker + CI/CD)

> **v3.1.0:** Suíte completa de testes automatizados (Pytest, 19 testes), Pipeline CI/CD GitHub Actions, Comparador visual de fotos antes/depois, Calculadora metabólica TMB/TDEE, Relatório médico consolidado em PDF, Motor de tendências de biomarcadores e Assistente de Saúde IA integrados.
> Itens marcados com ✅ foram implementados e verificados. Itens marcados com 📅 são planejados para infraestrutura futura de nuvem.

---

## Índice

1. [Visão Geral e Arquitetura](#1-visão-geral-e-arquitetura)
2. [Governança e Segurança](#2-governança-e-segurança)
3. [Falhas Críticas — Corrigidas](#3-falhas-críticas--corrigidas)
4. [Falhas de Segurança — Corrigidas](#4-falhas-de-segurança--corrigidas)
5. [Bugs e Problemas de Qualidade — Corrigidos](#5-bugs-e-problemas-de-qualidade--corrigidos)
6. [Melhorias de Frontend — Implementadas](#6-melhorias-de-frontend--implementadas)
7. [Melhorias de Backend — Implementadas](#7-melhorias-de-backend--implementadas)
8. [Guia de Execução Local e Testes](#8-guia-de-execução-local-e-testes)
9. [Roadmap de Infraestrutura](#9-roadmap-de-infraestrutura)
10. [Checklist de Auditoria](#10-checklist-de-auditoria)
11. [Registro de Alterações](#11-registro-de-alterações)
12. [Apêndices](#apêndice-a--variáveis-de-ambiente-de-referência)

---

## 1. Visão Geral e Arquitetura

### 1.1 Propósito do sistema

O Sistema Saúde é uma aplicação web de rastreamento de saúde pessoal que consolida múltiplos domínios de dados clínicos e antropométricos:

| Domínio | Dados coletados | Processamento |
|---|---|---|
| **Evolução física** | Fotos semanais, peso, % gordura, massa muscular | IA de visão (local ou LLM) — assíncrono |
| **Comparador de Fotos** | Comparação de fotos antes e depois | Slider interativo + cálculo de deltas antropométricos |
| **Metabolismo & Metas** | Altura, peso, data de nascimento, sexo e atividade | Equação Mifflin-St Jeor (TMB) + TDEE + metas calóricas |
| **Exames clínicos** | PDFs ou imagens de laudos laboratoriais | OCR + regex (local) ou LLM com human-in-the-loop |
| **Tendências de Biomarcadores** | Histórico consecutivo de laudos | Variação percentual ($\Delta\%$) e detecção preventiva de alertas |
| **Prontuário / Relatório** | Consolidado físico e clínico completo | Prontuário médico em PDF de alta resolução (`@media print`) |
| **Assistente de Saúde IA** | Dúvidas do usuário em linguagem natural | Chat contextualizado com histórico seguro de saúde |

### 1.2 Stack tecnológica

```
┌─────────────────────────────────────────────────────────┐
│  Frontend                                               │
│  Next.js 16.2.9 · React 19 · TypeScript strict          │
│  Tailwind v4 (CSS-based) · Recharts · Axios             │
│  Edge Middleware · Context API com Silent Refresh       │
├─────────────────────────────────────────────────────────┤
│  Backend                                                │
│  FastAPI 0.115.5 · Python 3.12 · Uvicorn               │
│  SQLAlchemy 2.0.36 (Mapped) · Alembic 1.14.0           │
│  bcrypt nativo · python-jose/JWT · pydantic-settings    │
│  cryptography (Fernet + HKDF) · slowapi (rate limiting) │
│  python-magic (validação MIME) · Pytest (19 testes)    │
├─────────────────────────────────────────────────────────┤
│  Banco de dados                                         │
│  PostgreSQL 16-alpine · JSONB para dados semi-struct.   │
│  Pool configurável via env (DB_POOL_SIZE etc.)          │
├─────────────────────────────────────────────────────────┤
│  IA / Visão Computacional & Assistente                  │
│  OpenAI SDK 1.57.0 (compatível com Gemini via base_url) │
│  Pillow 11.0.0 · pdfplumber 0.11.4                     │
├─────────────────────────────────────────────────────────┤
│  CI/CD & Automação                                      │
│  GitHub Actions (Pytest + Typecheck + Next.js Build)   │
└─────────────────────────────────────────────────────────┘
```

### 1.3 Topologia de serviços Docker

```
HOST (portas expostas ao operador)
│
├── :3000 ──► frontend (Next.js standalone)
│                │  rede: external
│                │
└── :8000 ──► backend (FastAPI/Uvicorn)
                 │  redes: external + internal
                 │
              127.0.0.1:5435 ──► db (PostgreSQL) ← apenas loopback
                                      rede: internal (isolada, internal:true)
```

### 1.4 Estrutura de rotas da API (v1)

| Método | Rota | Autenticação | Descrição |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Pública | Registra usuário |
| POST | `/api/v1/auth/login` | Pública (rate limit: 10/min) | Emite JWT curto (15 min) + refresh token (7 dias) |
| POST | `/api/v1/auth/refresh` | Cookie `ss_refresh_token` | Renova access + refresh token (rotation) |
| GET | `/api/v1/auth/me` | Cookie `ss_access_token` | Dados do usuário logado |
| POST | `/api/v1/auth/logout` | Cookie | Revoga refresh token + limpa cookies |
| GET | `/api/v1/physical/` | Cookie (limit max: 100) | Lista medições |
| POST | `/api/v1/physical/` | Cookie | Cria medição (IA em background) |
| GET | `/api/v1/physical/{id}` | Cookie | Detalhe da medição |
| DELETE | `/api/v1/physical/{id}` | Cookie | Remove medição + arquivo |
| GET | `/api/v1/clinical/` | Cookie (limit max: 100) | Lista exames |
| POST | `/api/v1/clinical/` | Cookie | Cria exame + extração |
| GET | `/api/v1/clinical/{id}` | Cookie | Detalhe do exame |
| PATCH | `/api/v1/clinical/{id}/data` | Cookie | Confirma dados manuais |
| DELETE | `/api/v1/clinical/{id}` | Cookie | Remove exame + arquivo |
| GET | `/api/v1/reports/summary` | Cookie | Relatório médico consolidado |
| POST | `/api/v1/assistant/chat` | Cookie | Conversa com a assistente de saúde IA |
| GET | `/api/v1/config/active` | Cookie | Configuração IA ativa |
| POST | `/api/v1/config/` | Cookie | Salva/substitui configuração |
| DELETE | `/api/v1/config/{id}` | Cookie | Remove configuração |
| GET | `/api/v1/admin/users/` | Superadmin | Lista todos os usuários |
| GET | `/api/v1/admin/users/{id}/config` | Superadmin | Config de usuário específico |
| POST | `/api/v1/admin/users/{id}/config` | Superadmin | Atualiza config de usuário |
| GET | `/health` | Pública | Healthcheck Docker |
| GET | `/uploads/{subfolder}/{filename}` | Cookie + IDOR check | Arquivos estáticos autenticados |

---

## 2. Governança e Segurança

### 2.1 Autenticação e autorização

**Mecanismo:** JWT HS256 em cookie `HttpOnly` + refresh token rotation.

- `SECRET_KEY` lido exclusivamente de variável de ambiente; sem valor padrão.
- ✅ **SECRET_KEY rotacionada** (v2.1.0) — nova chave com `secrets.token_hex(32)`.
- Access token expira em **15 minutos** (antes: 24h).
- Refresh token expira em **7 dias**, armazenado em cookie `HttpOnly` de path restrito.
- ✅ **Refresh token rotation** (v3.0.0) — ao usar o refresh, token antigo é deletado e novo é emitido.
- ✅ **Detecção de reuso** — se refresh já usado for apresentado, a família inteira é revogada.
- ✅ **Rate limiting no login:** 10 tentativas por minuto por IP (slowapi).
- Toda rota protegida usa `Depends(get_current_user)` via alias `CurrentUser`.
- Usuários inativados (`is_active=False`) recebem `HTTP 403` mesmo com token válido.

### 2.2 Armazenamento de senhas

- Algoritmo: **bcrypt nativo** (`bcrypt.gensalt()` + `bcrypt.hashpw()`).
- ✅ **Validação de senha aprimorada:** ao menos 8 caracteres, uma maiúscula e um número.

### 2.3 Criptografia de chaves de API

- ✅ **HKDF-SHA256** para derivação da chave Fernet (substituiu padding de zeros).
- ✅ **Sem fallback para plaintext** no `decrypt_api_key` — retorna `None` e loga o erro.

### 2.4 Controle de acesso por recurso

- Todas as queries filtram pelo `user_id` do token (IDOR prevenido).
- ✅ **Endpoint `/uploads` agora exige autenticação** com verificação de propriedade do arquivo.
- ✅ **Middleware Next.js** intercepta rotas antes da renderização e verifica cookie server-side.

---

## 3. Falhas Críticas — Corrigidas

### ✅ C-1 — SECRET_KEY comprometida rotacionada
**Arquivo:** `.env`  
**Status:** ✅ Corrigido em v2.1.0

### ✅ C-2 — Rede Docker com isolamento real
**Arquivo:** `docker-compose.yml` (`internal: true`)  
**Status:** ✅ Corrigido em v2.1.0

### ✅ C-3 — Endpoint `/uploads` agora exige autenticação
**Arquivo:** `backend/app/main.py`  
**Status:** ✅ Corrigido em v2.1.0

### ✅ C-4 — Rate limiting no endpoint de login
**Arquivo:** `backend/app/api/endpoints/auth.py` (10/min por IP)  
**Status:** ✅ Corrigido em v2.1.0

---

## 4. Falhas de Segurança — Corrigidas

### ✅ S-1 — Token JWT migrado de localStorage para cookie HttpOnly (v2.2.0)
### ✅ S-2 — CORS restrito (v2.1.0)
### ✅ S-3 — HKDF-SHA256 para criptografia de chaves de API (v2.1.0)
### ✅ S-4 — Validação de MIME type via python-magic (v2.1.0)
### ✅ S-5 — Validação de complexidade de senha (v2.1.0)
### ✅ S-6 — Sem fallback para plaintext no decrypt (v2.1.0)

---

## 5. Bugs e Problemas de Qualidade — Corrigidos

### ✅ B-1 — Hydration mismatch com `new Date()` no SSR (v2.1.0)
### ✅ B-2 — Erro de delete não exibido ao usuário (v2.1.0)
### ✅ B-3 — Confirmação de delete via `confirm()` nativo do browser (v2.1.0)
### ✅ B-4 — Proteção de rota admin dependia de client-side (v2.3.0)
### ✅ B-5 — Lista de modelos LLM com nomes genéricos (v2.1.0)
### ✅ B-6 — Dashboard não exibia erro quando qualquer requisição falhava (v2.1.0)
### ✅ B-7 — Pool de banco subdimensionado e sem configuração (v3.0.0)
### ✅ B-8 — `model_name` obrigatório sem validação para engine LOCAL (v2.1.0)
### ✅ B-9 — Paginação sem limite máximo (v2.1.0)
### ✅ B-10 — `PhysicalEvolution` e `ClinicalTest` sem `updated_at` (v2.1.0)

---

## 6. Melhorias de Frontend — Implementadas

### ✅ M-1 — FallbackForm pré-preenchida com dados extraídos (v2.1.0)
### ✅ M-2 — Verificação de expiração do token no cliente (v2.2.0)
### ✅ M-3 — Componente AiAnalysisCard (v2.3.0)
### ✅ M-4 — Paginação com "Ver mais" e hook `usePagination` (v2.3.0)

### ✅ M-10 — Comparador Visual de Fotos ("Antes & Depois")
**Arquivo:** `frontend/src/components/ui/PhotoComparisonModal.tsx` **(NOVO - v3.1.0)**  
**Implementação:**
- **Modo Slider:** Divisor horizontal arrastável sobrepondo fotos de antes e depois.
- **Modo Lado a Lado:** Split view em 2 colunas.
- **Quadro de Deltas:** Cálculo automático de $\Delta$ Peso, $\Delta$ % Gordura, $\Delta$ Massa Muscular, $\Delta$ IMC e dias decorridos.
- Integrado na página `/physical` através do botão *"📸 Comparar Fotos"*.

### ✅ M-11 — Calculadora Metabólica (TMB Mifflin-St Jeor & TDEE)
**Arquivo:** `frontend/src/components/ui/MetabolicCard.tsx` **(NOVO - v3.1.0)**  
**Implementação:**
- Cálculo de Taxa Metabólica Basal via equação de **Mifflin-St Jeor** (Homens e Mulheres).
- Estimativa de Gasto Energético Total Diário (TDEE) com seletor de 5 níveis de atividade física.
- Metas calóricas diárias personalizadas para Emagrecimento (-400 kcal), Manutenção e Hipertrofia (+300 kcal) renderizadas no Dashboard.

### ✅ M-12 — Relatório Médico Consolidado em PDF
**Arquivo:** `frontend/src/app/(protected)/reports/medical-summary/page.tsx` **(NOVO - v3.1.0)**  
**Implementação:**
- Prontuário médico estruturado reunindo perfil do paciente, medidas antropométricas com deltas, tabela de biomarcadores laboratoriais com faixas de referência e alertas clínicos.
- Estilização `@media print` para exportação direta em PDF de alta qualidade com layout profissional.

### ✅ M-15 — Assistente de Saúde IA (Chat Conversacional)
**Arquivo:** `frontend/src/components/ui/HealthAssistantModal.tsx` **(NOVO - v3.1.0)**  
**Implementação:**
- Modal de chat conversacional integrado com botão no Navbar e banner no Dashboard.
- Sugestões de perguntas rápidas, formatação rica de respostas e aviso de disclaimer médico.

---

## 7. Melhorias de Backend — Implementadas

### ✅ M-5a — Refresh Token com rotation (v3.0.0)
### ✅ M-5b — `updated_at` em PhysicalEvolution e ClinicalTest (v2.1.0)
### ✅ M-6 — Índice em `recorded_at` (v2.1.0)
### ✅ M-7 — Validação de MIME type (v2.1.0)
### ✅ M-8 — Tipagem forte do JSONB (v2.3.0)
### ✅ M-9 — Extração de IA assíncrona com BackgroundTasks (v2.3.0)

### ✅ M-13 — Suíte Completa de Testes Automatizados (Pytest)
**Arquivos:** `backend/tests/` **(NOVO - v3.1.0)**  
- `conftest.py` — Banco SQLite in-memory com compatibilidade de compilação JSONB, override de `get_db`, fixture `TestClient` e usuário de teste.
- `test_security.py` — 6 testes de segurança (bcrypt, JWT, refresh tokens, Fernet HKDF).
- `test_auth_endpoints.py` — 9 testes de integração (register, login, refresh rotation, logout, /me).
- `test_physical_endpoints.py` — CRUD físico e isolamento por usuário.
- `test_clinical_endpoints.py` — CRUD clínico e validação manual.
- `test_reports_and_assistant.py` — Relatório médico e chat do assistente.
- **Resultado:** **19 testes passando (100% de sucesso)**.

### ✅ M-14 — Pipeline de CI/CD (GitHub Actions)
**Arquivo:** `.github/workflows/ci.yml` **(NOVO - v3.1.0)**  
**Implementação:**
- Job `backend-tests`: Instalação de dependências (`libmagic`, requirements) e execução de `pytest tests/ -v`.
- Job `frontend-build`: Node.js 20, `npm ci`, typecheck e `npm run build`.

### ✅ M-16 — Motor de Tendências de Biomarcadores
**Arquivo:** `backend/app/services/biomarker_trends.py` **(NOVO - v3.1.0)**  
**Implementação:**
- Função `calculate_biomarker_trends` que calcula variações percentuais ($\Delta\%$) e deltas absolutos entre laudos laboratoriais consecutivos, gerando alertas preventivos automáticos.

---

## 8. Guia de Execução Local e Testes

### Execução com Docker
```bash
docker compose up --build
```

### Executar Testes Automatizados do Backend
```bash
cd backend
pytest tests/ -v
```

### Validar Build do Frontend
```bash
cd frontend
npm run build
```

---

## 9. Roadmap de Infraestrutura

| ID | Item | Status | Observação |
|---|---|---|---|
| I-1 | CI/CD com GitHub Actions | ✅ Concluído (v3.1.0) | `.github/workflows/ci.yml` |
| I-2 | Object storage (Cloudflare R2 / AWS S3) | 📅 Planejado | Substituir volume Docker para uploads |
| I-3 | Banco gerenciado em produção | 📅 Planejado | RDS, Supabase ou Neon |
| I-4 | Prometheus + Grafana | 📅 Planejado | Monitoramento de latência e pool |
| I-5 | Backups automáticos do PostgreSQL | 📅 Planejado | pg_dump diário com retenção de 30 dias |
| I-6 | Testes automatizados (pytest) | ✅ Concluído (v3.1.0) | 19 testes automatizados com 100% de sucesso |

---

## 10. Checklist de Auditoria

### Segurança — Backend
- [x] Senhas armazenadas como hash bcrypt nativo ✅
- [x] JWT assinado com chave de ambiente (sem default hardcoded) ✅
- [x] SECRET_KEY rotacionada ✅ (v2.1.0)
- [x] Isolamento de dados por `user_id` em todas as queries (IDOR prevenido) ✅
- [x] Validação de extensão de arquivo por allowlist ✅
- [x] Validação de MIME type além da extensão ✅ (v2.1.0)
- [x] Limite de 10 MB por arquivo ✅
- [x] Containers executam como usuário não-root (`appuser` uid 1001) ✅
- [x] Logs estruturados JSON — todos os loggers cobertos ✅
- [x] Criptografia HKDF-SHA256 para derivação da chave Fernet ✅ (v2.1.0)
- [x] Rate limiting no login: 10/min por IP ✅ (v2.1.0)
- [x] Rede Docker `internal: true` ativada ✅ (v2.1.0)
- [x] Endpoint `/uploads` exige autenticação e IDOR check ✅ (v2.1.0)
- [x] Refresh token rotation com detecção de reuso ✅ (v3.0.0)

### Qualidade — Backend & Engenharia
- [x] Testes automatizados com Pytest (19 testes, 100% pass) ✅ (v3.1.0)
- [x] Pipeline CI/CD no GitHub Actions ✅ (v3.1.0)
- [x] Motor de tendências de biomarcadores clínicos ✅ (v3.1.0)
- [x] Endpoint de relatório médico consolidado (`/reports/summary`) ✅ (v3.1.0)
- [x] Endpoint de assistente de saúde IA (`/assistant/chat`) ✅ (v3.1.0)
- [x] Extração de IA assíncrona (BackgroundTasks) ✅ (v2.3.0)
- [x] Pool de banco configurável via variáveis de ambiente ✅ (v3.0.0)

### Qualidade — Frontend & UX
- [x] Comparador visual de fotos antes/depois com slider interativo ✅ (v3.1.0)
- [x] Calculadora metabólica TMB (Mifflin-St Jeor) e TDEE com metas calóricas ✅ (v3.1.0)
- [x] Prontuário / Relatório médico consolidado em PDF (`@media print`) ✅ (v3.1.0)
- [x] Assistente de saúde IA conversacional (`HealthAssistantModal`) ✅ (v3.1.0)
- [x] Tokens JWT nunca armazenados em localStorage (Cookies HttpOnly) ✅ (v2.2.0)
- [x] Middleware Next.js protege rotas no servidor ✅ (v2.3.0)
- [x] Refresh silencioso automático a cada 13 minutos ✅ (v3.0.0)
- [x] Componente AiAnalysisCard para análise de IA legível ✅ (v2.3.0)
- [x] Botão "Ver mais" com paginação no histórico ✅ (v2.3.0)

---

## 11. Registro de Alterações

| Versão | Data | Mudanças |
|---|---|---|
| **v3.1.0** | 2026-08-31 | Suíte de testes Pytest (19 testes), Pipeline CI/CD GitHub Actions, Comparador Antes/Depois com Slider, Calculadora Metabólica TMB/TDEE, Relatório Médico em PDF, Tendências de Biomarcadores e Assistente IA |
| **v3.0.0** | 2026-06-16 | B-7 (pool configurável), M-5a (refresh token rotation), AuthContext com refresh automático |
| **v2.3.0** | 2026-06-16 | B-4 (middleware Next.js), M-3 (AiAnalysisCard), M-4 (usePagination + Ver mais), M-8 (tipagem JSONB), M-9 (IA assíncrona) |
| **v2.2.0** | 2026-06-16 | S-1 (JWT → cookie HttpOnly), logout com cookie, AuthContext cookie-based |
| **v2.1.0** | 2026-06-16 | C-1,2,3,4, S-2,3,4,5,6, B-1,2,3,5,6,8,9,10, M-1,2,5b,6,7 |
| **v2.0.0** | 2026-06-16 | Auditoria inicial do sistema |

---

## Apêndice A — Variáveis de ambiente de referência

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `POSTGRES_USER` | Sim | — | Usuário PostgreSQL |
| `POSTGRES_PASSWORD` | Sim | — | Senha PostgreSQL |
| `POSTGRES_DB` | Sim | — | Nome do banco |
| `DATABASE_URL` | Sim | — | URL completa de conexão |
| `SECRET_KEY` | Sim | — | Chave HMAC para JWT (≥32 bytes) |
| `ALGORITHM` | Não | `HS256` | Algoritmo JWT |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Não | `1440` | TTL do access token legado (não usado com refresh) |
| `UPLOAD_DIR` | Não | `uploads` | Diretório de upload no container |
| `ALLOWED_ORIGINS` | Não | `["http://localhost:3000"]` | CORS — array JSON |
| `APP_ENV` | Não | `development` | `development` ou `production` |
| `DB_POOL_SIZE` | Não | `5` | Conexões persistentes por worker |
| `DB_MAX_OVERFLOW` | Não | `10` | Conexões extras temporárias |
| `DB_POOL_TIMEOUT` | Não | `30` | Segundos até OperationalError |
| `DB_POOL_RECYCLE` | Não | `1800` | Reciclagem de conexões idle (segundos) |

---

## Apêndice B — Migrations

| Arquivo | Versão | Mudanças |
|---|---|---|
| `0001_initial_schema.py` | v1.0.0 | Schema inicial |
| `65da138a46ec_add_superadmin_and_custom_prompts.py` | v1.1.0 | Superadmin, prompts |
| `b7f3c9a12e45_audit_v2_updated_at_indexes.py` | v2.1.0 | M-5, M-6, B-8 |
| `c9e4d1f2a837_audit_v2_3_refresh_tokens.py` | v3.0.0 | M-5a: tabela refresh_tokens |

---

## Apêndice C — Arquivos modificados por versão

| Arquivo | Versão | Mudança |
|---|---|---|
| `.github/workflows/ci.yml` | v3.1.0 | M-14: Pipeline de CI/CD para GitHub Actions |
| `backend/requirements.txt` | v3.1.0 | pytest, pytest-asyncio, httpx |
| `backend/app/api/endpoints/reports.py` | v3.1.0 | M-12: Endpoint de relatório médico consolidado |
| `backend/app/api/endpoints/assistant.py` | v3.1.0 | M-15: Endpoint de chat da assistente IA |
| `backend/app/services/biomarker_trends.py` | v3.1.0 | M-16: Cálculo de deltas e alertas de biomarcadores |
| `backend/app/schemas/reports.py` | v3.1.0 | M-12: Schemas tipados de relatório consolidado |
| `backend/app/schemas/assistant.py` | v3.1.0 | M-15: Schemas tipados de chat com assistente |
| `backend/tests/*` | v3.1.0 | M-13: Suíte completa com 19 testes automatizados |
| `frontend/src/components/ui/PhotoComparisonModal.tsx` | v3.1.0 | M-10: Comparador visual com slider interativo |
| `frontend/src/components/ui/MetabolicCard.tsx` | v3.1.0 | M-11: Calculadora TMB (Mifflin-St Jeor) e TDEE |
| `frontend/src/components/ui/HealthAssistantModal.tsx` | v3.1.0 | M-15: Modal de chat com a assistente de IA |
| `frontend/src/app/(protected)/reports/medical-summary/page.tsx` | v3.1.0 | M-12: Prontuário médico com suporte a PDF |
| `frontend/src/app/(protected)/physical/page.tsx` | v3.1.0 | M-10: Integração do botão de comparação de fotos |
| `frontend/src/app/(protected)/dashboard/page.tsx` | v3.1.0 | M-11, M-12, M-15: Cards de TMB, atalhos de relatório e assistente |
| `frontend/src/components/layout/Navbar.tsx` | v3.1.0 | Atalhos de Relatório e Assistente IA |
| `backend/app/db/session.py` | v3.0.0–v3.1.0 | B-7: pool configurável e compatibilidade SQLite/PostgreSQL |
