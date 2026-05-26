/* eslint-disable @typescript-eslint/no-use-before-define */
/**
 * Drawer derecho que renderiza el playbook completo de una senal —
 * incluye estructura, trigger, target, stop, sizing, backtest empirico
 * y RAROC esperado.
 *
 * El playbook llega como markdown pre-renderizado desde el backend
 * (playbook_md). Lo pintamos con react-markdown + remark-gfm para
 * tablas.
 */
import React, { useEffect } from 'react';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { SignalRow } from 'src/lib/futures-monitor/types';
import { T, MONO } from './theme';

export default function PlaybookDrawer({
  signal,
  onClose,
}: {
  signal: SignalRow | null;
  onClose: () => void;
}) {
  // Cerrar con ESC
  useEffect(() => {
    if (!signal) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [signal, onClose]);

  if (!signal) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        role="presentation"
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          zIndex: 1040,
          animation: 'fadeIn 120ms ease',
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0, right: 0, bottom: 0,
          width: 'min(640px, 90vw)',
          background: T.surface,
          borderLeft: `1px solid ${T.hairline}`,
          boxShadow: '-12px 0 32px rgba(15, 23, 42, 0.12)',
          zIndex: 1050,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideIn 160ms ease',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 20px',
          borderBottom: `1px solid ${T.hairline}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: T.surfaceAlt,
        }}>
          <div>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.14em',
              color: T.muted, textTransform: 'uppercase', fontFamily: MONO,
              marginBottom: 4,
            }}>
              {signal.tipo} · {signal.liquidez}
            </div>
            <div style={{
              fontSize: 16, fontWeight: 700, color: T.ink,
              fontFamily: MONO, letterSpacing: '0.02em',
            }}>
              {signal.instrumento}
            </div>
            <div style={{
              fontSize: 11, color: T.muted, marginTop: 4, fontFamily: MONO,
            }}>
              <span style={{ fontWeight: 700, color: senalColor(signal.senal) }}>
                {signal.senal}
              </span>
              {' · '}
              Score ajustado <strong style={{ color: T.ink }}>{signal.score_ajustado.toFixed(2)}</strong>
              {' · '}
              {signal.conviccion}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              border: `1px solid ${T.hairline}`,
              background: T.surface,
              width: 32, height: 32,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              color: T.muted,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = T.ink;
              e.currentTarget.style.borderColor = T.accent;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = T.muted;
              e.currentTarget.style.borderColor = T.hairline;
            }}
          >
            <Icon icon={faTimes} />
          </button>
        </div>

        {/* Body — playbook markdown */}
        <div
          className="playbook-body"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            fontSize: 13,
            lineHeight: 1.55,
            color: T.inkSoft,
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {signal.playbook_md}
          </ReactMarkdown>
        </div>

        {/* Footer con metricas */}
        <div style={{
          padding: '12px 20px',
          borderTop: `1px solid ${T.hairline}`,
          background: T.surfaceAlt,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 0,
          fontFamily: MONO,
        }}>
          <FooterMetric label="Valor" value={signal.valor.toFixed(3)} />
          <FooterMetric label="Z-Score" value={signal.z_score.toFixed(2)} />
          <FooterMetric label="Pctil" value={`${signal.pctile.toFixed(0)}%`} />
          <FooterMetric label="MA 20D" value={signal.ma_20d.toFixed(3)} last />
        </div>

        <style jsx>{`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
          :global(.playbook-body h5) {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: ${T.muted};
            margin: 20px 0 8px;
            padding-bottom: 4px;
            border-bottom: 1px solid ${T.hairlineSoft};
          }
          :global(.playbook-body h5:first-child) { margin-top: 0; }
          :global(.playbook-body strong) { color: ${T.ink}; font-weight: 700; }
          :global(.playbook-body code) {
            font-family: ${MONO};
            background: ${T.surfaceAlt};
            border: 1px solid ${T.hairlineSoft};
            padding: 1px 4px;
            font-size: 12px;
          }
          :global(.playbook-body ul) { padding-left: 20px; margin: 8px 0; }
          :global(.playbook-body li) { margin-bottom: 4px; }
          :global(.playbook-body table) {
            width: 100%;
            border-collapse: collapse;
            margin: 8px 0 12px;
            font-family: ${MONO};
            font-size: 12px;
            font-variant-numeric: tabular-nums;
          }
          :global(.playbook-body th) {
            text-align: left;
            border-bottom: 1px solid ${T.hairline};
            padding: 6px 8px;
            color: ${T.muted};
            font-weight: 700;
            font-size: 10px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          :global(.playbook-body td) {
            border-bottom: 1px solid ${T.hairlineSoft};
            padding: 5px 8px;
          }
          :global(.playbook-body p) { margin: 6px 0; }
        `}
        </style>
      </div>
    </>
  );
}

function FooterMetric({
  label, value, last,
}: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{
      padding: '4px 12px',
      borderRight: last ? 'none' : `1px solid ${T.hairlineSoft}`,
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.14em',
        color: T.muted, textTransform: 'uppercase',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 700, color: T.ink,
        fontVariantNumeric: 'tabular-nums',
        marginTop: 2,
      }}>
        {value}
      </div>
    </div>
  );
}

function senalColor(senal: string): string {
  if (senal.includes('VENDER')) return T.red;
  if (senal.includes('COMPRAR')) return T.green;
  if (senal === 'STEEP') return T.blue;
  if (senal === 'FLAT') return T.purple;
  return T.muted;
}
