# TASK: Issue #163 — Portfolio: UI para configurar fuentes de market data

## Issue
https://github.com/avelezX/xerenity-fe/issues/163
Branch: `feature/163-market-data-config`

## Descripcion
UI para que el usuario configure cuales fuentes de datos marcan cada variable de mercado en el portafolio.

## UI requerido
- Sección/modal de Settings en la página de Portfolio
- Dropdowns por variable:
  - **Spot FX**: SET FX | FXEmpire | Manual
  - **Curva NDF**: FXEmpire fwd_pts | DTCC | Implied | Manual
  - **IBR**: (definir fuentes disponibles leyendo el código)
  - **SOFR**: (definir fuentes disponibles leyendo el código)
- Guardar config
- Indicador visual cerca del CurveStatusBar mostrando qué fuente está activa

## Archivos clave
- `src/pages/portfolio/index.tsx` — página principal (2159 líneas), tiene CurveStatusBar
- `src/store/trading/index.ts` — TradingSlice (agregar marketDataConfig state)
- `src/types/trading.ts` — agregar tipo MarketDataConfig
- `src/models/trading/` — agregar fetchMarketDataConfig / saveMarketDataConfig

## Dependencias backend
- pysdk #56: endpoint `market-data-config` (puede no existir aún)
- xerenity-db: tabla `trading.market_data_config`
- Si el endpoint no responde → usar localStorage como fallback

## Reglas
- Branch: `feature/163-market-data-config`
- Commits frecuentes con `closes #163`
- Al terminar crear PR
