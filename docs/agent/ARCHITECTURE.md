# Xerenity AI Agent — Arquitectura tecnica

Detalle tecnico del flujo del agente. Complementa [README.md](./README.md).

---

## Flujo de un mensaje

```
Usuario escribe en ChatPanel
  ↓
store/chat/sendMessage(content)
  ↓
  ├─ Agrega user + assistant message vacio a chatMessages
  ├─ Construye apiMessages con contexto del chart si aplica
  │  [CONTEXTO DEL GRAFICO ACTUAL: TRM, IBR 3m | Periodo: 1Y]
  └─ streamChat(apiMessages, onEvent, abortSignal)
      ↓
      fetch('/api/chat', { method:'POST', body:{messages}, stream:true })
      ↓
      /api/chat handler:
        ├─ createPagesServerClient (sesion Supabase via cookies)
        ├─ Rate limit check (20 msg/min in-memory)
        ├─ SSE headers: text/event-stream
        ├─ buildSystemPrompt(userName, supabase)
        │   ├─ Verifica cache (60s TTL)
        │   ├─ supabase.rpc('get_active_agent_skills') si expiro
        │   └─ Concatena: greeting + GUIDANCE + skills.map(s => s.content)
        ├─ AGENTIC LOOP (max 10 iteraciones):
        │   ├─ anthropic.messages.stream({ model, tools, system, messages })
        │   ├─ stream.on('text', delta => sendSSE 'text_delta')
        │   ├─ await stream.finalMessage()
        │   ├─ if stop_reason === 'end_turn': sendSSE 'done', break
        │   └─ if stop_reason === 'tool_use':
        │       ├─ Para cada tool_use block:
        │       │   ├─ sendSSE 'tool_use' (frontend muestra "Consultando...")
        │       │   ├─ executeTool(name, input, supabase)
        │       │   │   ├─ query_database → agent_query RPC (SQL read-only)
        │       │   │   ├─ view_series → return { chartAction:'load_series', tickers, names }
        │       │   │   ├─ control_chart → return { chartAction: {...} }
        │       │   │   ├─ navigate_to → return { navigationTarget }
        │       │   │   ├─ create_position → user session RPC (RLS aplica)
        │       │   │   └─ create_loan → create_credit RPC
        │       │   ├─ sendSSE 'tool_result' con seriesData/chartAction/navTarget/chartData
        │       │   └─ Push tool_result al messages array
        │       └─ continue loop
        └─ res.end()
  ↓
Frontend recibe eventos SSE:
  ├─ text_delta → append a assistantMessage.content
  ├─ tool_use → agregar toolCall con status='pending'
  ├─ tool_result → status='success', extraer seriesAction/chartControlAction/navigationTarget
  ├─ error → chatError
  └─ done → chatLoading=false
  ↓
ChatPanel useEffect detecta cambios en last message:
  ├─ seriesAction → addTickerToChart(ticker, name) para cada uno; router.push('/suameca') si no esta ahi
  ├─ chartControlAction → setChartPeriod / setNormalizeChart / clearChart / removeFromChart
  └─ navigationTarget → router.push(target)
```

---

## Cache del system prompt

**Por que existe:** Cada mensaje a Claude usa el system prompt completo (~15-20K tokens). Sin cache, cada mensaje haria un round-trip a DB para leer los skills. Con cache (60s TTL), la mayoria de mensajes leen de memoria.

**Implementacion:** `src/pages/api/chat/system-prompt.ts` mantiene variable `cache` a nivel de modulo. Cada instancia de Vercel tiene su propia copia. TTL: 60 segundos.

**Consecuencias:**
- Editar un skill en `/admin/agent` no se refleja inmediatamente. Espera hasta 60s.
- Multiples instancias de Vercel expiran independientemente. En teoria un mensaje puede llegar a una instancia con cache viejo y otro a una nueva.
- Hay una funcion `invalidateSkillsCache()` exportada pero no se usa (podria invocarse desde el admin UI al guardar, pero no vale la pena la complejidad).

---

## GUIDANCE — instrucciones estables

Ademas de los skills editables, hay un bloque **GUIDANCE** hardcodeado en `system-prompt.ts` con instrucciones criticas que no queremos que un super_admin pueda romper accidentalmente:

```
Antes de escribir SQL con query_database, usá las herramientas de catálogo
(list_data_catalog, describe_table, describe_lineage) para descubrir qué tablas
y columnas existen — NO inventes nombres de tablas ni columnas. Para graficar
series preferí find_and_chart_series. query_database es solo-lectura (SELECT) y
requiere permisos de super_admin; si no tenés permiso, explicá al usuario en vez
de reintentar.
```

Este bloque se inserta **entre** el greeting y los skills. Si necesitas cambiarlo, edita `system-prompt.ts` directamente (requiere PR).

---

## Tool executor

`src/pages/api/chat/tool-executor.ts` — todos los tools se despachan aqui.

### query_database
- Recibe `input.sql`
- Valida via regex que empieza con SELECT o WITH
- Llama `supabase.rpc('agent_query', { p_sql })` que hace segunda validacion en DB
- Devuelve resultados como JSON

### view_series
- Recibe `input.tickers[]`, `input.names[]`, `input.description`
- **No hace nada en el backend** — solo empaqueta la accion para el frontend
- Devuelve `{ chartAction: 'load_series', tickers, names, description }`
- El ChatPanel ejecuta `addTickerToChart` para cada ticker

### control_chart
- Recibe `input.action` (set_period | normalize | clear | remove_series) + parametros
- Igual que view_series: solo empaqueta, el frontend ejecuta

### navigate_to
- Valida path contra whitelist
- Devuelve `{ navigationTarget: path }`

### create_position / create_loan
- Usa la sesion del usuario (RLS aplica)
- Llama RPC apropiada (create_ndf_position, create_credit, etc.)
- El agente debe pedir confirmacion antes por convencion del prompt (no forzado en codigo)

---

## Streaming SSE

Formato de eventos enviados por `/api/chat`:

```
data: {"type":"text_delta","text":"Hola"}\n\n
data: {"type":"tool_use","tool":"query_database","toolCallId":"tool_01ABC","input":{...}}\n\n
data: {"type":"tool_result","tool":"query_database","toolCallId":"tool_01ABC","result":{...}}\n\n
data: {"type":"tool_result","tool":"view_series","toolCallId":"tool_02XYZ","seriesData":{"tickers":[...],"names":[...]}}\n\n
data: {"type":"tool_result","tool":"control_chart","toolCallId":"tool_03DEF","chartAction":{"action":"normalize","normalize":true}}\n\n
data: {"type":"done"}\n\n
data: {"type":"error","error":"..."}\n\n
```

Frontend parser: `src/utils/sse-client.ts`.

---

## Rate limiting

`src/pages/api/chat/rate-limiter.ts` — in-memory Map por instancia de Vercel.

- Limite: 20 mensajes por minuto por usuario
- Ventana rolling: cada request suma, se limpia al cabo de 60s del primer request de la ventana
- Si excedes: 429 con retryAfterMs

**Limitacion:** cada instancia de Vercel tiene su Map. En teoria un usuario podria hacer 20 msg en instancia A + 20 msg en instancia B. En la practica no es problema. Para produccion real (MCP publico), migrar a Redis.

---

## Base de datos (schema completo agente)

```sql
-- Skills (system prompt modules)
xerenity.agent_skills (
  id uuid PK,
  name text UNIQUE,
  description text,
  content text,
  active boolean,
  display_order int,
  current_version int,
  created_by, updated_by uuid REFERENCES auth.users,
  created_at, updated_at timestamptz
)

-- Version history
xerenity.agent_skills_versions (
  id uuid PK,
  skill_id uuid FK,
  version_number int,
  name, description, content text,     -- snapshot
  change_note text,
  changed_by uuid,
  changed_at timestamptz,
  UNIQUE (skill_id, version_number)
)

-- Chat suggestions (no versioning)
xerenity.agent_suggestions (
  id uuid PK,
  icon text,
  title text,
  prompt text,
  display_order int,
  active boolean,
  created_by, updated_by uuid,
  created_at, updated_at timestamptz
)
```

RLS:
- authenticated puede SELECT solo activos
- super_admin puede TODO (via `EXISTS ... user_profiles WHERE role='super_admin'`)

---

## Zustand slices

- **ChatSlice** (`src/store/chat/index.ts`): chatMessages, sendMessage, chatLoading, streaming logic
- **MarketDashboardSlice** (`src/store/marketDashboard/index.ts`): chartSelections, chartPeriod, addTickerToChart, setChartPeriod, setNormalizeChart, clearChart, removeFromChart
- **AgentConfigSlice** (`src/store/agentConfig/index.ts`): skills, suggestions, CRUD actions para admin UI

Todas combinadas en `src/store/index.ts`.

---

## Puntos de extension

Cuando agregues un nuevo tool al agente:

1. **Definir tool** en `src/pages/api/chat/tools.ts`:
   ```ts
   {
     name: 'my_new_tool',
     description: 'Que hace y cuando usarlo',
     input_schema: { type:'object', properties:{...}, required:[...] }
   }
   ```

2. **Ejecutar tool** en `src/pages/api/chat/tool-executor.ts`:
   ```ts
   if (name === 'my_new_tool') {
     const result = await doSomething(input, supabase);
     return { success:true, data: result };
   }
   ```

3. **Si tiene efecto en el frontend** (como view_series/control_chart), agregar campo al tool result:
   ```ts
   return { success:true, data:..., customAction: {...} };
   ```
   Y manejarlo en `store/chat/index.ts` (SSE handler) + `ChatPanel.tsx` (useEffect).

4. **Actualizar skill "Reglas de tools"** via `/admin/agent` (NO editar system-prompt.ts).

5. **Crear eval test** en `src/evals/test-cases/`.

6. **Correr** `npm run test:agent -- --test XX`.
