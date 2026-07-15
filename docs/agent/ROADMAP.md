# Xerenity AI Agent — Roadmap hacia MCP Server

**Owner:** Andres Velez
**Estado:** v1 completado (agente embebido con admin de skills). Ahora entramos en la fase de **nutrir el agente** con acceso real a datos y evolucionarlo hasta convertirlo en un **MCP Server publico**.

---

## Vision

Hoy Xerenity tiene un agente Claude embebido en el frontend que consulta la DB, grafica series y crea posiciones. Es util para usuarios internos.

**El siguiente salto** es hacer que ese conocimiento y esos accesos sean **exponibles como MCP Server**. Un MCP Server permite que cualquier LLM (Claude Desktop, ChatGPT via connector, Cursor, tu propio agente en pysdk, etc.) se conecte a Xerenity y acceda a los datos con las mismas capacidades que hoy tiene el chat interno.

**Por que MCP:** protocolo estandar de Anthropic (Nov 2024), ya soportado por Claude Desktop, ChatGPT, Cursor, muchas otras herramientas. Es donde va la industria.

---

## Fase actual (v1) — DONE

- [x] Chat embebido con Claude (SSE streaming, agentic loop)
- [x] 6 tools: query_database, view_series, control_chart, navigate_to, create_position, create_loan
- [x] Admin UI `/admin/agent` con skills modulares versionados
- [x] Sugerencias del chat editables
- [x] Framework de evals (12 tests)
- [x] Inteligencia economica (periodicidades, comparaciones)
- [x] Chart context awareness

---

## Fase 2 — Nutrir el agente (SIGUIENTE ITERACION)

**Meta:** El agente actualmente **apenas tiene un lector/interpretador de texto**. Necesita mas skills y mejor acceso a datos antes de exponerlo como MCP.

### Tareas priorizadas

#### 2.1 Skills adicionales (semana 1-2)
Crear via `/admin/agent` (no en codigo):

- [ ] **Skill: Riesgos** — como consultar VaR, exposicion, marks, curvas de sensibilidad. Referencia tablas: `xerenity.futures_position`, `xerenity.reference_prices`, RPCs de riesgo.
- [ ] **Skill: Prestamos** — como interpretar cash flows, tipos (fija/ibr/uvr), tabla de amortizacion. Referencia: `loans.loan`, `loans.cash_flow`, RPCs de calculo.
- [ ] **Skill: TES portfolio** — pricing de TES individual, portafolio agregado, marcas de mercado.
- [ ] **Skill: Marks de mercado** — tabla `xerenity.reference_prices`, historia de marks por instrumento.
- [ ] **Skill: FIC hierarchy** — compartimentos vs fondos padres, agrupacion, filtros por tamaño/tipo.

Cada skill deberia:
- Explicar cuales tablas/RPCs usar
- Dar ejemplos de queries tipicos
- Advertir sobre periodicidades y unidades

**Como probar:** correr evals despues de cada skill nuevo. Crear test cases especificos en `src/evals/test-cases/`.

#### 2.2 Nuevos tools (semana 2-3)

- [ ] **`compute_portfolio_metrics(company_id, valuation_date)`** — llamar a repricePortfolio del pysdk, devolver JSON.
- [ ] **`search_series(query, group?, limit?)`** — abstraer la busqueda en search_mv (hoy el agente hace query_database directo).
- [ ] **`get_loan_cashflows(loan_id)`** — devolver tabla de amortizacion completa.
- [ ] **`compare_series(tickers[], metric)`** — devolver estadisticas comparativas (correlacion, vol, drawdown).

Definir en `src/pages/api/chat/tools.ts`, ejecutar en `tool-executor.ts`.

#### 2.3 Feature: Vista del prompt completo (~2h)
En `/admin/agent` agregar boton "Ver prompt actual" que muestre el string exacto que se envia a Claude (todos los skills activos concatenados con el GUIDANCE). Sirve para debug.

#### 2.4 Feature: Probar skill en sandbox (~1 dia)
Boton "Probar" en cada skill que:
1. Toma el estado actual de todos los skills activos
2. + Aplica el skill que se esta editando temporalmente (sin guardar)
3. Abre un chat de test aislado (no toca el chat real del usuario)
4. Permite probar la nueva version antes de activarla

#### 2.5 Feature: Diff entre versiones (~2h)
En el modal de historial, mostrar diff visual entre v(n) y v(n-1) usando algo como `diff` package.

---

## Fase 3 — Preparar para MCP (posterior)

### 3.1 Extraer logica del agente a paquete standalone
Hoy toda la logica esta acoplada a Next.js (`/api/chat`). Necesitamos extraerla a un paquete que se pueda montar como MCP server independiente.

Estructura propuesta:
```
xerenity-mcp/                          # Repo nuevo
├── src/
│   ├── tools/                         # Copiar de xerenity-fe/src/pages/api/chat/tools.ts
│   ├── executors/                     # Copiar de tool-executor.ts (adaptado)
│   ├── skills-loader.ts               # Lee skills de la misma DB
│   └── server.ts                      # MCP protocol server
├── package.json
└── README.md
```

### 3.2 Autenticacion MCP
El chat interno usa Supabase session cookies. MCP necesita:
- API keys de servicio publicas emitidas por Xerenity (una por cliente)
- Rate limiting por API key
- Auditoria de uso

Crear tabla `xerenity.mcp_api_keys` (owner, name, key_hash, scopes[], created_at, last_used_at, rate_limit_per_min).

### 3.3 Publicar MCP server
- Deployment como servicio separado (Fly.io, Railway, o Vercel Edge Functions)
- Documentacion publica para clientes
- Manifest en `mcp.xerenity.co/.well-known/mcp.json`

### 3.4 Vercel MCP integration
Ya existe una **infraestructura sugerida** por Anthropic donde MCP Servers se pueden hostear directamente en Vercel Edge. Investigar si aplica.

**Nota:** ya hay un proyecto Linear "Xerenity MCP Server" (SAM project id `6c910b45-0cea-47f7-8e9c-49339412e958`) creado para esto. Ese es el destino final.

---

## Referencias tecnicas de MCP

- Especificacion: https://spec.modelcontextprotocol.io/
- SDK TypeScript: https://github.com/modelcontextprotocol/typescript-sdk
- Ejemplos de servidores: https://github.com/modelcontextprotocol/servers
- Anuncio de Anthropic (Nov 2024): https://www.anthropic.com/news/model-context-protocol
- Ya soportado nativamente por: Claude Desktop, Cursor, Zed, Continue, VSCode (via extensions)

---

## Convenciones para esta fase

1. **Todo trabajo del agente = una issue en Linear** bajo el proyecto "Xerenity MCP Server" (Saman wm team).
2. **Nuevos skills se crean en `/admin/agent`** (no hardcode en `system-prompt.ts`).
3. **Nuevos tools SI se codean** — en `tools.ts` + `tool-executor.ts`. Documentar el nuevo tool aca en ROADMAP.md.
4. **Cada tool nuevo requiere un eval test** en `src/evals/test-cases/`.
5. **PRs deben referenciar la issue Linear**: `Closes SAM-XX`.

---

## Contacto y contexto

- **Owner producto:** Andres Velez (a.velez@saman-wm.com)
- **Codebase principal:** `avelezX/xerenity-fe`
- **DB migrations:** `avelezX/xerenity-db`
- **Backend pricing:** `avelezX/pysdk`
- **Chat interno:** ya en produccion en https://xerenity.vercel.app
- **Deploy:** Vercel auto-deploy en merge a main
