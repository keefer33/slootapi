# slootAPI

## 🛠️ Overview

slootAPI is the Express backend for [sloot.ai](https://sloot.ai): JWT auth, agent loading, tool execution, Pipedream actions, Flux image routes, payments, account/API keys, Coolify proxy routes, webhooks, and streaming-friendly handlers.

## 🌐 Website

[https://sloot.ai](https://sloot.ai)

## ⭐ Features

- 🤖 **Multi-provider AI** — Anthropic, OpenAI, Gemini, xAI, and related chat tooling
- 🧰 **Tools** — Run registered tools, list Sloot tools, polling file helpers
- 🔌 **Pipedream** — Connect tokens, apps, accounts, and action runs
- 💳 **Payments** — Stripe intents, balance, transactions, usage deduction
- 🎨 **Flux** — BFL Flux image routes (Kontext, Pro, Dev, Ultra, etc.)
- 🖥️ **Coolify** — Applications, databases, servers, services, user cloud records
- 📡 **Webhooks** — Kie.ai and polling callbacks
- 🔐 **JWT** — `verifyJWT` on protected route groups

## 📁 Project structure

```
src/
├── controllers/
├── middleware/
├── routes/
│   ├── tools/flux/
│   └── coolify/
├── utils/
├── types/
├── routes/index.ts    # Mounts route modules (see Endpoints)
└── index.ts
```

## 🔐 Authentication

Protected route groups use JWT middleware (`verifyJWT`). Send:

```http
Authorization: Bearer <token>
```

`POST /auth/create-token` mints or exchanges tokens (see `authController`).

## 📡 Endpoints

Paths are mounted at the **server root** (no `/api` prefix) as defined in `src/routes/index.ts`. Replace `{origin}` with your API base URL.

### ✅ Root & health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | No | API info and route index |
| `GET` | `/healthcheck` | No | Health check |

### 🔑 Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/create-token` | No | Create / exchange token |

### 🤖 Agents

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/agents` | Yes | Load agent (`loadAgent`) |

### 🧰 Tools

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/tools/run` | Yes | Execute tool |
| `GET` | `/tools/sloot` | Yes | Load Sloot tools |
| `GET` | `/tools/polling-files` | Yes | List polling files |
| `GET` | `/tools/polling-file/:id` | Yes | Polling file by id |

### 🔌 Pipedream

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/pipedream` | Yes | Smoke / status |
| `GET` | `/pipedream/connect/token` | Yes | Create connect token |
| `POST` | `/pipedream/run` | Yes | Run Pipedream action |
| `GET` | `/pipedream/apps` | Yes | List apps |
| `GET` | `/pipedream/app/:appId` | Yes | App detail |
| `GET` | `/pipedream/app/categories` | Yes | App categories |
| `POST` | `/pipedream/accounts/list` | Yes | List accounts |
| `GET` | `/pipedream/account/app/:accountId` | Yes | Account app |
| `POST` | `/pipedream/account/tools/delete` | Yes | Delete tools for account |
| `POST` | `/pipedream/account/delete` | Yes | Delete connected account |

### 🛠️ Utils

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/utils/json-formatter` | Yes | Format JSON |
| `POST` | `/utils/tools-schema-generator` | Yes | Tools schema helper |
| `POST` | `/utils/chat-completions` | Yes | Chat completions utility |

### 💳 Payments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/payments/create-intent` | Yes | Create payment intent |
| `POST` | `/payments/confirm` | Yes | Confirm payment |
| `POST` | `/payments/add-funds` | Yes | Add funds |
| `POST` | `/payments/deduct-usage` | Yes | Deduct usage |
| `GET` | `/payments/balance` | Yes | Balance |
| `GET` | `/payments/transactions` | Yes | Transactions |

### 👤 Account

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/account/apikeys` | Yes | List API keys (masked) |

### 🎨 Flux (BFL)

Each Flux family exposes **create**, **poll**, and **generate** routes under `/flux`:

| Prefix | Verbs |
|--------|--------|
| `/flux/flux-kontext-pro` | `POST` create, `GET` poll, `POST` generate |
| `/flux/flux-kontext-max` | same |
| `/flux/flux-pro` | same |
| `/flux/flux-dev` | same |
| `/flux/flux-pro-ultra` | same |

All require JWT.

### 🖥️ Coolify

JWT required. High-level groups (see `src/routes/coolify/coolifyRoutes.ts` for full list):

| Group | Examples |
|--------|----------|
| Resources | `GET /coolify/resources`, `GET /coolify/resources/:id` |
| Applications | `GET /coolify/applications`, lifecycle `.../start|stop|restart` |
| Databases | `GET /coolify/databases`, `POST` create by engine, start/stop/restart, `PATCH`/`DELETE` by uuid |
| Servers | `GET|POST|PATCH|DELETE /coolify/servers`, resources, domains, validate |
| Services | create/update/delete, env CRUD, start/stop/restart, user cloud DB linkage |
| User DBs | `GET|POST|PATCH|DELETE /coolify/user-databases`, `GET .../uuid/:uuid` |

### 🪝 Webhooks

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/webhooks/kieai` | No | Kie.ai webhook |
| `POST` | `/webhooks/polling` | No | Supabase polling webhook |
| `GET` | `/webhooks/polling` | No | Polling probe |

## 🔗 Integrations

| Integration | Role |
|-------------|------|
| 🖥️ [Coolify](https://coolify.io/) | Server and resource management |
| 🔌 [Pipedream](https://pipedream.com/) | Connected apps and actions |
| ▲ [Vercel AI Gateway](https://vercel.com/ai-gateway) | Optional model routing |
| 🗄️ [Supabase](https://supabase.com/) | Database and auth |
| 💳 [Stripe](https://stripe.com/) | Payments |

## 🧱 Tech stack

- 🟢 **Node.js** — Runtime
- 🚂 **Express** — HTTP API
- 🔷 **TypeScript**
- 🗄️ **Supabase** — Client
- 💳 **Stripe**
- 🤖 **Anthropic**, **OpenAI**, **Google GenAI**, **xAI** — Providers (via controllers)
- 🔌 **Pipedream SDK**, **MCP SDK** — Integrations
- 📦 **axios**, **cors**, **cookie-parser**, **dotenv**

## 📜 Scripts

| Command | Purpose |
|--------|---------|
| `npm run dev` | ⚡ Nodemon + ts-node |
| `npm run build` | 📦 `tsc` compile |
| `npm start` | 🚀 Run `dist/index.js` |
| `npm run dev:build` | 📦 Build then start |
| `npm test` | 🧪 Jest |
| `npm run lint` | 🔍 ESLint |
| `npm run lint:fix` | ✨ ESLint fixes |
| `npm run format` | 📝 Prettier write |
| `npm run format:check` | ✔️ Prettier check |
| `npm run check` | 🔍 Lint + format check |
| `npm run clean` | 🧹 Remove `dist` |
