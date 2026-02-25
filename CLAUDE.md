# Xerenity Frontend

## Qué es
Frontend de la plataforma Xerenity. Aplicación web para visualización de datos financieros, series de tiempo, curvas de rendimiento, y dashboards de portafolio.

## Stack
- Next.js (TypeScript)
- React
- Tailwind CSS
- Vercel (deploy)

## Deploy
- Vercel auto-deploya al mergear a main
- Variables de entorno configuradas en Vercel Dashboard
- NO pushear directo a main

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
