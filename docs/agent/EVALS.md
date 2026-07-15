# Xerenity AI Agent — Framework de Evals

Sistema de testing automatizado para el agente. Ejecuta prompts contra la API real de Claude y valida los tool calls que hace.

---

## TL;DR

```bash
npm run test:agent                     # Corre los 12 tests (~$0.50-1.00 USD)
npm run test:agent -- --test Q1        # Un solo test
npm run test:agent -- --category chart # Solo una categoria
npm run test:agent -- --verbose        # Muestra tool calls y respuestas
```

Costo esperado: ~$1 USD por corrida completa. Cache de skills expira en 60s, asi que test suite completo ejecuta ~1 hit a `get_active_agent_skills`.

---

## Que se valida

**Tool calls, no texto.** El agente responde en lenguaje natural (no deterministico), pero los tool calls que hace son estructurales y validables.

Cada test case define:
- Un prompt del usuario
- Los tools esperados (nombre, orden, parametros)
- Match parcial: no todos los params tienen que coincidir, solo los criticos

Ejemplo:
```ts
{
  id: 'C1',
  category: 'chart',
  name: 'USDCOP este mes',
  prompt: 'Como ha estado el dolar este mes?',
  expectedTools: [
    { name: 'query_database' },
    { name: 'view_series' },
  ],
}
```

---

## Estructura de test cases

Ubicacion: `src/evals/test-cases/`

```
test-cases/
├── portfolio.ts    # Crear NDF, XCCY, IBR Swap (3 tests)
├── charts.ts       # Graficar series economicas (3 tests)
├── queries.ts      # Consultas de datos puntuales (3 tests)
├── navigation.ts   # navigate_to a paginas especificas (2 tests)
└── multi-turn.ts   # Conversaciones multi-turno (1 test)
```

Formato de cada test case (`src/evals/types.ts`):
```ts
interface TestCase {
  id: string;
  category: 'portfolio' | 'chart' | 'query' | 'navigation' | 'multi-turn';
  name: string;
  prompt: string;
  expectedTools: ExpectedTool[];
  followUp?: TestCase;  // Para multi-turn
}
```

---

## Como agregar un test nuevo

1. Elegir categoria adecuada (o crear archivo nuevo si es dominio distinto).
2. Agregar objeto en el array export:
   ```ts
   // src/evals/test-cases/charts.ts
   export const chartTests: TestCase[] = [
     // ... existing
     {
       id: 'C4',
       category: 'chart',
       name: 'Comparar tasas de politica USA vs Colombia',
       prompt: 'Comparame la Fed Funds Rate con la tasa de politica monetaria de Colombia',
       expectedTools: [
         { name: 'query_database' },        // Busqueda de tickers
         { name: 'view_series' },           // Carga en el chart
         { name: 'control_chart' },         // Normalizar (opcional)
       ],
     },
   ];
   ```
3. Correr `npm run test:agent -- --test C4` para verificar.

---

## Test runner (como funciona)

`src/evals/runner.ts`:

```
Para cada test case:
  1. Construir messages = [{ role:'user', content: prompt }]
  2. Loop hasta max 10 iteraciones:
     - Llamar anthropic.messages.create(model, system, tools, messages)
     - Recolectar tool_use blocks
     - Simular tool responses (respuestas mock)
     - Continuar loop
  3. Evaluar tool calls vs expectedTools
  4. Reportar PASS/FAIL con razones
```

**Nota:** Los tool responses son MOCK. No ejecuta las queries reales ni crea posiciones. Solo valida que el agente HACE el tool call correcto.

---

## Interpretacion de resultados

Salida ejemplo:
```
Running 12 test(s)...

✓ Q1 (query): TRM hoy → 3.2s, 2 iters, 1 tool call
✓ C1 (chart): USDCOP este mes → 4.5s, 3 iters, 2 tool calls
✗ P1 (portfolio): Crear NDF 1M → 6.1s, FAILED
  Expected tool 'create_position' not called
  Agent said: "Necesitas un valor de spot para calcular..."

Results: 11/12 passed (91%)
Total time: 42.3s
Total cost estimate: $0.87
```

---

## Manual test (exploratorio)

`src/evals/manual-test.ts` — script simple para probar prompts ad-hoc contra el agente.

```bash
npx tsx src/evals/manual-test.ts "Graficame el PIB"
```

Util para debug rapido sin escribir un test case formal.

---

## Cuando correr los evals

**Obligatorio antes de mergear PRs que:**
- Modifican tools.ts o tool-executor.ts
- Modifican el system prompt / GUIDANCE en system-prompt.ts
- Modifican logica de agentic loop en /api/chat/index.ts

**Recomendado despues de:**
- Editar skills en `/admin/agent` (correr los tests relacionados a lo que cambiaste)
- Agregar un tool nuevo (crear test correspondiente y correrlo)

**No necesario para:**
- Cambios de UI del ChatPanel
- Cambios de admin UI de skills
- Cambios en la DB que no cambian comportamiento del agente

---

## Reglas para agregar tests

1. **Un test por tool nuevo**: si agregas `compute_portfolio_metrics`, agrega un test que lo dispare.
2. **Nombres cortos**: `C1`, `Q3`, `P2`. Facil referenciar con `--test`.
3. **Prompts realistas**: como los que un usuario real escribiria, no ideales artificiales.
4. **Match parcial**: no valides todos los params, solo los criticos (evita fragilidad).
5. **Documentar categoria nueva**: si creas `src/evals/test-cases/risk.ts`, actualiza este doc.

---

## Costo por test

- Query simple (Q*): ~$0.02
- Chart con view_series (C*): ~$0.05
- Portfolio con confirmacion (P*): ~$0.08
- Multi-turn: ~$0.10-0.15

Total suite (12 tests): **~$0.80-1.00 USD por corrida**.

---

## Referencias

- Framework: `src/evals/`
- Types: `src/evals/types.ts`
- Anthropic pricing: https://www.anthropic.com/pricing (Sonnet 4.5)
