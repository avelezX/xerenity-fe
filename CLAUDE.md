# Xerenity Frontend - Claude Agent Workflow

## Qué es
Frontend de la plataforma Xerenity. Aplicación web para visualización de datos financieros, series de tiempo, curvas de rendimiento, y dashboards de portafolio.

## Project Info
- **GitHub Org:** avelezX
- **Repo:** xerenity-fe
- **GitHub Project:** Xerenity (#4)
- **Tech:** Next.js (TypeScript), React, Tailwind CSS
- **Deploy:** Vercel (auto-deploy al mergear a main)

## Comandos
```bash
npm install
npm run dev      # desarrollo local
npm run build    # build de producción
npm run lint     # linting
```

## Reglas
- Siempre referenciar una issue en commits: `closes #X`
- No pushear directo a main, usar PRs
- Componentes en PascalCase, archivos en kebab-case
- Variables sensibles en .env.local (nunca commitear)

## Session Startup Protocol

**Al inicio de cada sesion, SIEMPRE ejecutar estos pasos antes de cualquier otra cosa:**

1. **Consultar GitHub Projects** - Listar las tareas pendientes del proyecto Xerenity:
   ```bash
   export PATH="$PATH:/c/Program Files/GitHub CLI"
   gh project item-list 4 --owner avelezX --format json
   ```

2. **Mostrar resumen al usuario** - Presentar tabla con:
   - Status (Todo, In Progress, Done)
   - Titulo
   - Repo asociado (filtrar las relevantes a este repo: xerenity-fe)
   - Prioridad si la tiene
   Filtrar y mostrar primero las tareas "In Progress" y "Todo".

3. **Preguntar cual tarea trabajar** - Si el usuario no especifica, preguntar cual tarea del backlog quiere abordar.

## Repos del ecosistema Xerenity
- **xerenity-fe** - Frontend (este repo)
- **xerenity-dm** - Data management / collectors (Python)
- **xerenity-db** - Migraciones y esquema DB (SQL/Supabase)
- **xerenity-api** - API
- **pysdk** - Python SDK / pricing backend
- **XerenityAddin** - Excel Addin (C#)
- **xerenity-explorer** - Explorador de datos (Python/Jupyter)
- **ui-components** - Libreria de componentes UI

## Workflow por Tarea

### 1. Crear branch
```bash
git checkout main && git pull
git checkout -b feature/<issue-number>-<short-description>
```

### 2. Trabajar en la tarea
- Leer y entender el codigo existente antes de modificar
- Hacer commits frecuentes con mensajes descriptivos
- Seguir las convenciones existentes (componentes, tipos, stores)
- Tipos en `src/types/`, API client en `src/lib/`, stores en `src/stores/`

### 3. Documentar mientras se trabaja
- Si hay cambios significativos, actualizar documentacion relevante
- Cada commit debe tener un mensaje claro que explique el "por que"

### 4. Al completar la tarea
- Crear un Pull Request con:
  - Titulo claro referenciando la tarea
  - Descripcion detallada de los cambios
  - Referencia al issue (`Closes #N`)
- Agregar issue al project si no esta:
  ```bash
  gh project item-add 4 --owner avelezX --url <issue-url>
  ```

### 5. Crear nuevas tareas si se descubren
```bash
gh issue create --repo avelezX/xerenity-fe --title "..." --body "..."
gh project item-add 4 --owner avelezX --url <issue-url>
```

## Convenciones de Commits
```
<type>(<scope>): <description>

[optional body]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```
Tipos: feat, fix, docs, refactor, test, chore
