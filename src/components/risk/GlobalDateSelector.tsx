/* eslint-disable jsx-a11y/control-has-associated-label */
/**
 * Selector global de fecha del modulo de Riesgos.
 *
 * Diseño: "trading desk precision" — terminal-grade adaptado a tema claro.
 *   - Tipografia monospace con tabular-nums para todas las cifras.
 *   - Acento amber instrumental (#9a3412) solo en estados activos/hover.
 *   - Sin radius >2px, sin transiciones >100ms, sin gradientes.
 *   - El mes se muestra como "MAY · 2026" (abreviatura caps + interpunct + año).
 *
 * Lee/escribe globalEvaluationDate + dateSelectorMode del store
 * (Zustand, persistido en localStorage). El consumidor (paginas) siempre
 * lee un ISO string "YYYY-MM-DD" via activeEvaluationDate().
 */
import { ChangeEvent } from 'react';
import useAppStore from 'src/store';
import {
  parseISOAsNoon,
  formatISO,
  lastBusinessDayOfMonth,
  prevMonth,
  nextMonth,
  MONTH_NAMES_SHORT,
} from 'src/lib/risk/dateHelpers';

// ─────────────────────────────────────────────────────────────────
// Design tokens (scoped a este componente)
// ─────────────────────────────────────────────────────────────────
const T = {
  ink: '#0f172a',
  inkSoft: '#1e293b',
  muted: '#64748b',
  mutedDim: '#94a3b8',
  surface: '#ffffff',
  surfaceAlt: '#f8fafc',
  hairline: '#cbd5e1',
  hairlineSoft: '#e2e8f0',
  accent: '#9a3412',
  accentSoft: '#fed7aa',
};

const MONO = "'IBM Plex Mono', 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace";

// ─────────────────────────────────────────────────────────────────
export default function GlobalDateSelector() {
  const date = useAppStore((s) => s.globalEvaluationDate);
  const mode = useAppStore((s) => s.dateSelectorMode);
  const setDate = useAppStore((s) => s.setGlobalEvaluationDate);
  const setMode = useAppStore((s) => s.setDateSelectorMode);

  const currentDate = parseISOAsNoon(date);

  const handleModeChange = (newMode: 'month' | 'day') => {
    setMode(newMode);
    if (newMode === 'month') {
      setDate(formatISO(lastBusinessDayOfMonth(currentDate)));
    }
  };

  const handlePrevMonth = () => setDate(formatISO(prevMonth(currentDate)));
  const handleNextMonth = () => setDate(formatISO(nextMonth(currentDate)));

  const handleDayChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) setDate(value);
  };

  const monthAbbr = MONTH_NAMES_SHORT[currentDate.getUTCMonth()].toUpperCase();
  const year = currentDate.getUTCFullYear();
  const day = String(currentDate.getUTCDate()).padStart(2, '0');
  const monthSmall = MONTH_NAMES_SHORT[currentDate.getUTCMonth()].toLowerCase();

  return (
    <div className="gds-root">
      {/* Toggle segmentado MES / DÍA */}
      <div className="gds-toggle" role="group" aria-label="Modo de selección">
        <button
          type="button"
          className={`gds-toggle-btn ${mode === 'month' ? 'is-active' : ''}`}
          onClick={() => handleModeChange('month')}
          aria-pressed={mode === 'month'}
        >
          MES
        </button>
        <button
          type="button"
          className={`gds-toggle-btn ${mode === 'day' ? 'is-active' : ''}`}
          onClick={() => handleModeChange('day')}
          aria-pressed={mode === 'day'}
        >
          DÍA
        </button>
      </div>

      <span className="gds-divider" aria-hidden="true" />

      {/* Control segun modo */}
      {mode === 'month' ? (
        <div className="gds-control">
          <button
            type="button"
            className="gds-chevron"
            onClick={handlePrevMonth}
            aria-label="Mes anterior"
          >
            ‹
          </button>

          <div className="gds-display">
            <div className="gds-display-primary">
              <span className="gds-month">{monthAbbr}</span>
              <span className="gds-interpunct">·</span>
              <span className="gds-year">{year}</span>
            </div>
            <div className="gds-display-secondary">
              {day} {monthSmall}
            </div>
          </div>

          <button
            type="button"
            className="gds-chevron"
            onClick={handleNextMonth}
            aria-label="Mes siguiente"
          >
            ›
          </button>
        </div>
      ) : (
        <div className="gds-control">
          <input
            type="date"
            className="gds-date-input"
            value={date}
            onChange={handleDayChange}
            aria-label="Fecha de evaluación"
          />
          <div className="gds-day-caption">específico</div>
        </div>
      )}

      <style jsx>{`
        .gds-root {
          display: inline-flex;
          align-items: stretch;
          gap: 10px;
          padding: 4px 6px 4px 4px;
          background: ${T.surface};
          border: 1px solid ${T.hairline};
          font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
        }

        /* Toggle segmentado */
        .gds-toggle {
          display: inline-flex;
          align-items: stretch;
          border: 1px solid ${T.hairline};
          background: ${T.surfaceAlt};
        }
        .gds-toggle-btn {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.12em;
          color: ${T.muted};
          background: transparent;
          border: none;
          cursor: pointer;
          transition: color 80ms ease, background-color 80ms ease;
          font-feature-settings: 'tnum';
        }
        .gds-toggle-btn:not(:last-child) {
          border-right: 1px solid ${T.hairline};
        }
        .gds-toggle-btn:hover:not(.is-active) {
          color: ${T.ink};
          background: ${T.surface};
        }
        .gds-toggle-btn.is-active {
          color: ${T.surface};
          background: ${T.ink};
        }
        .gds-toggle-btn:focus-visible {
          outline: 2px solid ${T.accent};
          outline-offset: -2px;
        }

        /* Divider vertical hairline */
        .gds-divider {
          width: 1px;
          background: ${T.hairlineSoft};
          align-self: stretch;
          margin: 0 2px;
        }

        /* Wrapper del control activo */
        .gds-control {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        /* Chevron buttons */
        .gds-chevron {
          width: 26px;
          height: 26px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: ${MONO};
          font-size: 16px;
          font-weight: 600;
          line-height: 1;
          color: ${T.inkSoft};
          background: ${T.surfaceAlt};
          border: 1px solid ${T.hairline};
          cursor: pointer;
          transition: color 80ms ease, background-color 80ms ease, border-color 80ms ease;
        }
        .gds-chevron:hover {
          color: ${T.accent};
          background: ${T.surface};
          border-color: ${T.accent};
        }
        .gds-chevron:active {
          background: ${T.accentSoft};
        }
        .gds-chevron:focus-visible {
          outline: 2px solid ${T.accent};
          outline-offset: 2px;
        }

        /* Display "MAY · 2026" + sub "15 may" */
        .gds-display {
          min-width: 110px;
          text-align: center;
          padding: 0 4px;
        }
        .gds-display-primary {
          display: inline-flex;
          align-items: baseline;
          gap: 6px;
          font-family: ${MONO};
          line-height: 1;
        }
        .gds-month {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.14em;
          color: ${T.ink};
        }
        .gds-interpunct {
          font-size: 13px;
          font-weight: 500;
          color: ${T.mutedDim};
          transform: translateY(-1px);
        }
        .gds-year {
          font-size: 13px;
          font-weight: 500;
          color: ${T.inkSoft};
          font-variant-numeric: tabular-nums;
          font-feature-settings: 'tnum';
          letter-spacing: 0.02em;
        }
        .gds-display-secondary {
          margin-top: 3px;
          font-family: ${MONO};
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.08em;
          color: ${T.muted};
          font-variant-numeric: tabular-nums;
          font-feature-settings: 'tnum';
          text-transform: uppercase;
        }

        /* Input date para modo Dia */
        .gds-date-input {
          font-family: ${MONO};
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.04em;
          color: ${T.ink};
          padding: 4px 8px;
          background: ${T.surface};
          border: 1px solid ${T.hairline};
          font-variant-numeric: tabular-nums;
          font-feature-settings: 'tnum';
          transition: border-color 80ms ease;
        }
        .gds-date-input:hover {
          border-color: ${T.inkSoft};
        }
        .gds-date-input:focus {
          outline: none;
          border-color: ${T.accent};
        }
        .gds-day-caption {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.1em;
          color: ${T.muted};
          text-transform: uppercase;
          font-family: ${MONO};
        }
      `}
      </style>
    </div>
  );
}
