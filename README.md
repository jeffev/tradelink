# Tradelink

Plataforma de análise e gestão de trading — diário de trades, backtesting com múltiplos indicadores, simulação de DCA e scanner de mercado.

**Demo em produção:** [tradelink.jeffersonvalandro.com.br](https://tradelink.jeffersonvalandro.com.br)

Na demo, **Entrar como visitante** abre uma conta de exemplo sem cadastro: ~100 trades com cotações reais, estratégias, backtests, simulações de DCA, filtros e alertas. A conta é apagada em 24 horas. Para desligar em outro servidor, use `DEMO_ENABLED=false` no backend.

---

## Funcionalidades

**Diário de Trades**
- Registro manual de trades (entrada, saída, stop, target, P&L automático)
- Métricas de desempenho: Sharpe, Sortino, win rate, R:R médio, fator de lucro
- Análise psicológica: confiança, emoção na entrada, qualidade de execução
- Filtros e histórico completo

**Backtesting**
- Estratégia multi-indicador: combine RSI, MACD, Stochastic, CCI, ADX, Williams %R, OBV, ATR, BB %B, SMA, VWAP, Volume Ratio, VP POC/VAH/VAL Cross
- Condições customizáveis de entrada e saída por indicador (operador + valor)
- Filtro de volume: Volume Ratio (relativo à SMA) confirma ou filtra sinais
- Condições de Volume Profile: cruzamento do preço com POC, VAH ou VAL por período (semanal/mensal/trimestral)
- Gráfico de velas (candlestick) com zoom/pan, marcadores de compra/venda e painéis de osciladores sincronizados
- Selector de altura do gráfico (P/M/G/GG)
- Métricas: retorno total, anualizado, drawdown máximo, Sharpe, Calmar, win rate, profit factor
- Comparação de múltiplos backtests

**DCA & Aportes Periódicos**
- Simule aportes semanais, quinzenais, mensais ou trimestrais
- Compare DCA fixo vs Lump Sum vs DCA condicional (aportar só quando indicador atingir condição)
- Gráfico comparativo de crescimento patrimonial + custo médio por estratégia

**Indicadores Técnicos**
- 16 indicadores: SMA, EMA, BB, VWAP, SAR, Pivot Points, RSI, MACD, ATR, Stochastic, CCI, ADX, Williams %R, OBV, Ichimoku, Volume Profile (períodos: semanal/mensal/trimestral/anual)
- Gráfico TradingView (lightweight-charts): candlestick, zoom/pan, painéis de osciladores sincronizados
- Volume Profile com step lines de POC, VAH e VAL por janela de tempo configurável
- Selector de altura do gráfico (P/M/G/GG)

**Scanner & Alertas**
- Filtros por condições de indicadores em múltiplos tickers
- Alertas automáticos quando condições são atingidas

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend API | NestJS + TypeORM + PostgreSQL |
| Frontend | React + Vite + TailwindCSS + lightweight-charts (TradingView OSS) |
| Engine de Backtesting | Python FastAPI + pandas + yfinance |
| Fila de jobs | BullMQ + Redis |
| Banco (produção) | Neon (PostgreSQL serverless) |
| Cache/Fila (produção) | Upstash Redis |
| Deploy frontend | Vercel |
| Deploy backend/worker | Render |

---

## Desenvolvimento local

### Pré-requisitos

- Node.js 20+
- Python 3.11+
- Docker e Docker Compose

### Setup

```bash
git clone https://github.com/jeffev/tradelink.git
cd tradelink
cp apps/backend/.env.example apps/backend/.env
```

**Docker (recomendado — sobe tudo):**
```bash
docker compose up --build
```

| Serviço | URL |
|---------|-----|
| Frontend | http://localhost |
| Backend API | http://localhost:3001/api |
| Worker (Python) | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:3001/api/docs |

**Hot-reload (desenvolvimento):**
```bash
# Terminal 1 — banco + redis
docker compose up postgres redis -d

# Terminal 2 — backend
cd apps/backend && npm install && npm run start:dev

# Terminal 3 — worker Python
cd apps/backtesting-worker && pip install -r requirements.txt && uvicorn main:app --reload --port 8000

# Terminal 4 — frontend
cd apps/frontend && npm install && npm run dev
```

---

## Variáveis de ambiente

Copie `apps/backend/.env.example` para `apps/backend/.env` e preencha:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_DATABASE=tradelink

JWT_SECRET=troque-por-uma-string-segura
JWT_EXPIRES_IN=24h

NODE_ENV=development
PORT=3001

CORS_ORIGIN=http://localhost:5173
WORKER_URL=http://localhost:8000
```

---

## Arquitetura em produção

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Usuário (browser)                          │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Vercel (CDN global)                                                │
│  React + Vite SPA  →  tradelink-nine.vercel.app                     │
│  vercel.json: SPA rewrites + build workspace                        │
└────────────────────────────┬────────────────────────────────────────┘
                             │ REST / JSON  (VITE_API_URL)
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Render — Web Service (Docker)                                      │
│  NestJS API  →  tradelink-backend.onrender.com/api                  │
│  • Autenticação JWT                                                 │
│  • CRUD: trades, estratégias, filtros, alertas                      │
│  • Enfileira jobs de backtest/DCA no BullMQ                         │
│  • Proxy de indicadores para o worker                               │
└──────────┬────────────────────────────┬────────────────────────────┘
           │ TypeORM                    │ BullMQ (ioredis)
           ▼                            ▼
┌──────────────────────┐   ┌────────────────────────────────────────┐
│  Neon (PostgreSQL     │   │  Upstash Redis (serverless)            │
│  serverless)          │   │  • Fila de jobs (BullMQ)               │
│  • Todos os dados     │   │  • Conexão TLS obrigatória             │
│    persistentes       │   │    (rediss://...)                      │
└──────────────────────┘   └──────────────┬─────────────────────────┘
                                           │ job dispatched
                                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Render — Web Service (Docker)                                      │
│  Python FastAPI Worker  →  tradelink-worker.onrender.com            │
│  • /run-backtest  — backtester.py + pandas                          │
│  • /run-dca       — dca_engine.py                                   │
│  • /calculate-indicators — indicators.py (16 indicadores)           │
│  • /scan          — scanner.py + yfinance                           │
└─────────────────────────────────────────────────────────────────────┘
```

### Fluxo de um backtest

```
Frontend → POST /api/backtesting         (NestJS)
         → job adicionado na fila Redis  (BullMQ)
         → worker consome o job          (Python FastAPI)
         → calcula indicadores + engine  (pandas / yfinance)
         → resultado salvo no PostgreSQL (TypeORM)
         → GET /api/backtesting/:id      (frontend polling)
```

### Considerações do free tier

| Serviço | Limitação | Impacto |
|---------|-----------|---------|
| Render (backend) | Dorme após 15 min | Primeiro request ≈ 30s para "acordar" |
| Render (worker) | Dorme após 15 min | Primeiro backtest pode demorar mais |
| Neon | 512 MB storage | Suficiente para dados de trading |
| Upstash | 10 k comandos/dia (free) | Adequado para uso normal |
| Vercel | Sem cold start (CDN) | Carregamento instantâneo |

---

## Deploy (produção gratuita)

### Serviços necessários (todos free tier)

| Serviço | Para quê | Link |
|---------|----------|------|
| Neon | PostgreSQL | neon.tech |
| Upstash | Redis | upstash.com |
| Render | Backend + Worker | render.com |
| Vercel | Frontend | vercel.com |

### Passo a passo

**1. Banco e fila**
- Crie um projeto no [Neon](https://neon.tech) → copie a `DATABASE_URL`
- Crie um banco no [Upstash](https://upstash.com) → copie a `REDIS_URL` (`rediss://...`)

**2. Render (backend + worker)**
- New → Blueprint → conecte este repositório
- O `render.yaml` configura os dois serviços automaticamente
- Preencha as variáveis marcadas como `sync: false` no dashboard:
  - `DATABASE_URL` — do Neon
  - `REDIS_URL` — do Upstash
  - `CORS_ORIGIN` — URL do Vercel (preencher após o passo 3)
  - `WORKER_URL` — URL do worker após ele subir (ex: `https://tradelink-worker.onrender.com`)

**3. Vercel (frontend)**
- New Project → conecte este repositório
- Root directory: `apps/frontend`
- Adicione a variável de ambiente:
  - `VITE_API_URL` = `https://tradelink-backend.onrender.com/api`
- Após o deploy, copie a URL gerada e atualize `CORS_ORIGIN` no Render

> **Free tier:** O Render "dorme" após 15 min de inatividade — o primeiro request leva ~30s para acordar.

---

## Estrutura do projeto

```
tradelink/
├── apps/
│   ├── backend/               # NestJS API
│   │   └── src/
│   │       ├── auth/          # JWT authentication
│   │       ├── trades/        # Trade journal
│   │       ├── strategies/    # Strategy management
│   │       ├── backtesting/   # Backtest jobs + queue
│   │       ├── dca/           # DCA simulation jobs
│   │       ├── indicators/    # Indicator calculation proxy
│   │       ├── filters/       # Market scanner
│   │       ├── alerts/        # Price alerts
│   │       └── portfolio/     # Dashboard metrics
│   │
│   ├── frontend/              # React + Vite
│   │   └── src/
│   │       ├── pages/         # Routes (Backtests, DCA, Trades…)
│   │       ├── components/    # UI + Charts (lightweight-charts)
│   │       ├── services/      # API clients
│   │       └── types/         # TypeScript interfaces
│   │
│   └── backtesting-worker/    # Python FastAPI
│       ├── main.py            # Endpoints: /run-backtest /run-dca /calculate-indicators
│       ├── backtester.py      # Engine de backtesting
│       ├── dca_engine.py      # Engine de DCA
│       ├── indicators.py      # Cálculo de indicadores (pandas)
│       └── scanner.py         # Market scanner
│
├── docker-compose.yml
├── render.yaml                # Deploy Render (backend + worker)
└── vercel.json                # Deploy Vercel (SPA routing)
```

---

## Licença

MIT
