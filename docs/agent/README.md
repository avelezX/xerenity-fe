# Xerenity AI Agent — Documentación técnica

Punto de entrada para desarrolladores que trabajan en el agente de IA embebido en Xerenity.

---

## Vision del proyecto

**Estado actual (v1):** El agente es un chatbot embebido en el frontend que usa Claude (Anthropic API) con `tool_use` para consultar la DB, graficar series, navegar la app, y crear posiciones/prestamos. El "entrenamiento" del agente se hace via una admin UI (`/admin/agent`) donde super_admins pueden editar skills modulares con versionado.

**Meta final (v2, roadmap):** Evolucionar el agente hasta convertirlo en un **MCP Server** publico. En vez de que el agente sea solo un chat interno, seria un servidor MCP al que cualquier LLM (Claude Desktop, ChatGPT, Cursor, etc.) puede conectarse para acceder a los datos de Xerenity. Ver [docs/agent/ROADMAP.md](./ROADMAP.md).

---

## Estructura del agente en el codigo

```
src/
├── pages/api/chat/          # Backend del agente (Next.js API routes)
│   ├── index.ts             # POST /api/chat — SSE streaming, agentic loop
│   ├── suggestions.ts       # GET /api/chat/suggestions — botones del chat
│   ├── system-prompt.ts     # Async, lee skills de DB con cache 60s
│   ├── tools.ts             # Definiciones de tools Anthropic
│   ├── tool-executor.ts     # Ejecuta tools contra Supabase/RPCs
│   └── rate-limiter.ts      # 20 msg/min por usuario
│
├── components/chat/         # UI del chat
│   ├── ChatContainer.tsx    # Wrapper Bubble + Panel
│   ├── ChatBubble.tsx       # Boton flotante bottom-right
│   ├── ChatPanel.tsx        # Panel slide-in con mensajes
│   ├── ChatMessage.tsx      # Render de mensaje individual
│   └── ChatChart.tsx        # Recharts inline (legacy, poco usado)
│
├── pages/admin/agent/       # Admin UI para entrenar
│   ├── index.tsx            # Tabs Skills + Sugerencias
│   ├── _SkillsTab.tsx       # Lista + toggle + acciones
│   ├── _SkillEditorModal.tsx    # Editar con nota obligatoria
│   ├── _SkillHistoryModal.tsx   # Historial + revert
│   ├── _SuggestionsTab.tsx      # CRUD simple sin historial
│   └── _SuggestionEditorModal.tsx
│
├── store/
│   ├── chat/index.ts        # ChatSlice — mensajes, streaming, seriesAction
│   └── agentConfig/index.ts # AgentConfigSlice — skills + sugerencias CRUD
│
├── types/
│   ├── chat.ts              # ChatMessage, SSEEvent, SeriesAction, etc.
│   └── agent-config.ts      # AgentSkill, AgentSkillVersion, AgentSuggestion
│
├── models/agentConfig/index.ts   # Wrappers de RPCs
│
└── evals/                   # Framework de eval del agente
    ├── index.ts             # CLI (npm run test:agent)
    ├── runner.ts            # Loop agentico contra Claude real
    ├── evaluator.ts         # Valida tool calls vs expectativas
    ├── manual-test.ts       # Tests exploratorios sueltos
    └── test-cases/          # 12 test cases en 5 categorias
```

---

## Base de datos (Supabase - schema `xerenity`)

### Tablas del agente
- `agent_skills` — modulos de prompt (activo/inactivo, orden, current_version)
- `agent_skills_versions` — historial completo (cada edit → nueva version)
- `agent_suggestions` — botones del chat vacio (sin versionado)

### RPCs relevantes
Todas `SECURITY DEFINER`, gate via `_assert_super_admin()`:
- Skills: `list_agent_skills`, `get_active_agent_skills`, `create/update/toggle/delete_agent_skill`, `list_agent_skill_versions`, `revert_agent_skill`
- Sugerencias: `list_agent_suggestions`, `get_active_agent_suggestions`, `create/update/toggle/delete_agent_suggestion`

### Otras RPCs que el agente usa
- `agent_query(p_sql text)` — SQL read-only (solo SELECT/WITH). Doble validacion regex + funcion DB.
- `create_ndf_position`, `create_xccy_position`, `create_ibr_swap_position`, `create_tes_position`, `create_credit` (existentes en trading/loans)
- `search_mv` (materialized view) — catalogo de series para busqueda por nombre

---

## Tools del agente (Anthropic tool_use)

| Tool | Que hace |
|---|---|
| `query_database` | Ejecuta SELECT contra Supabase via `agent_query` RPC |
| `view_series` | Carga series en el chart de SUAMECA sin recargar (via Zustand store) |
| `control_chart` | Modifica el chart actual: set_period, normalize, clear, remove_series |
| `navigate_to` | Router push a una path whitelisted |
| `create_position` | Crea NDF/XCCY/IBR_SWAP/TES (pide confirmacion primero) |
| `create_loan` | Crea prestamo via create_credit (pide confirmacion primero) |
| `generate_chart` | Deprecated — no usar (chart inline en chat) |

---

## Flujo del entrenamiento

1. Super admin va a `/admin/agent` → tab Skills
2. Ve la lista de skills modulares (Identidad, Base de datos, Reglas de tools, etc.)
3. Edita un skill → escribe nota obligatoria → guarda → nueva version en historial
4. En <60s (cache TTL), el proximo mensaje del chat usa el skill actualizado
5. Si sale mal → tab Historial → seleccionar version previa → Revertir

**Nota critica:** el cache en `system-prompt.ts` es in-memory por proceso. En Vercel puede haber multiples instancias — cada una expira independientemente. Esto es OK para casi todos los casos, pero cambios criticos pueden tardar hasta ~1 min en propagar globalmente.

---

## Variables de entorno requeridas

```
ANTHROPIC_API_KEY=sk-ant-...         # Server-only, sin NEXT_PUBLIC_
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # Solo server-side, para agent_query
```

En Vercel, configurar todas en Environment Variables → Production + Preview.

---

## Seguridad

- `ANTHROPIC_API_KEY` solo server-side (nunca en NEXT_PUBLIC_)
- `agent_query` restringida a SELECT/WITH via regex + funcion DB (doble validacion)
- Creacion de posiciones usa sesion del usuario (RLS aplica)
- Rate limit: 20 mensajes/minuto por usuario (in-memory por instancia)
- Skills/sugerencias: super_admin ALL, authenticated SELECT solo activos
- El agente pide confirmacion antes de mutaciones (create_position, create_loan)

---

## Testing

### Evals automaticos
```bash
npm run test:agent                    # 12 tests contra API real (~$0.50-1.00 USD)
npm run test:agent -- --test Q1       # Un test especifico
npm run test:agent -- --category chart # Solo charts
npm run test:agent -- --verbose       # Output detallado
```

Ver [docs/agent/EVALS.md](./EVALS.md) para detalles.

### Manual
Abrir el chat en produccion (bubble bottom-right) y probar los prompts de las sugerencias.

---

## Referencias

- [ROADMAP.md](./ROADMAP.md) — Siguiente iteracion (skills, MCP server)
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Detalle tecnico del agentic loop, SSE, tool execution
- Plan file completo: `.claude/plans/shimmying-squishing-marble.md` (local, no en git)
- Linear: [Saman wm team](https://linear.app/saman-wm), issue master **SAM-18**
- PRs relevantes: #257 (chat inicial), #268 (evals), #270 (view_series), #276 (chart directo), #279 (economic intelligence), #281 (control_chart), #310 (admin de skills)

---

## Convenciones para modificar el agente

1. **NO edites `system-prompt.ts` directamente** para agregar conocimiento — usa `/admin/agent` skills.
2. **Editar system-prompt.ts SI**: cambias la logica del cache, GUIDANCE, o la estructura del prompt.
3. **Al agregar un nuevo tool**: definir en `tools.ts`, implementar en `tool-executor.ts`, manejar SSE en `api/chat/index.ts`, procesar en `store/chat/index.ts` y opcionalmente en `ChatPanel.tsx`.
4. **Al cambiar la DB**: crear migracion en `xerenity-db/migrations/` con nombre `YYYYMMDD_nombre.sql`. Aplicarla via Supabase MCP o SQL console.
5. **Costos**: cada mensaje al agente cuesta ~$0.01-0.05 USD. Los evals completos cuestan ~$1 USD.
