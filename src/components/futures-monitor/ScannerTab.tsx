/* eslint-disable @typescript-eslint/no-use-before-define */
/**
 * Tab Scanner — lista de senales ordenadas por Score ajustado con cards
 * de conviccion + boton para abrir drawer con el playbook completo.
 *
 * Acepta filtro para mostrar/ocultar iliquidas. Las iliquidas tienen
 * score_ajustado = 0 (x0 multiplier) — quedan al final si se incluyen.
 */
import React, { useState, useMemo } from 'react';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faChevronRight,
  faExclamationTriangle,
  faCheckCircle,
} from '@fortawesome/free-solid-svg-icons';
import type { SignalRow } from 'src/lib/futures-monitor/types';
import PlaybookDrawer from './PlaybookDrawer';
import { T, MONO, fmtSigned } from './theme';

export default function ScannerTab({
  signalsOperable,
  signalsIliquid,
}: {
  signalsOperable: SignalRow[];
  signalsIliquid: SignalRow[];
}) {
  const [showIliquidas, setShowIliquidas] = useState(false);
  const [selected, setSelected] = useState<SignalRow | null>(null);

  const visibleSignals = useMemo(() => {
    if (showIliquidas) {
      return [...signalsOperable, ...signalsIliquid];
    }
    return signalsOperable;
  }, [signalsOperable, signalsIliquid, showIliquidas]);

  if (signalsOperable.length === 0 && signalsIliquid.length === 0) {
    return (
      <div style={{
        padding: 40, textAlign: 'center', color: T.muted,
        border: `1px solid ${T.hairlineSoft}`, background: T.surfaceAlt,
        fontFamily: MONO, fontSize: 12,
      }}>
        Sin senales extremas — spreads y butterflies dentro de ±1.5σ.
        El mercado no presenta dislocaciones significativas.
      </div>
    );
  }

  return (
    <>
      {/* ─── Toolbar ──────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, fontFamily: MONO, fontSize: 11,
      }}>
        <div style={{ color: T.muted, letterSpacing: '0.04em' }}>
          Score ajustado = Score × multiplicador liquidez. MARGINAL ×0.7, ILIQUIDA ×0.
          {' '}Click una senal para ver el playbook completo.
        </div>
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 10px', border: `1px solid ${T.hairline}`,
          cursor: 'pointer', userSelect: 'none', color: T.inkSoft,
          fontWeight: 600, letterSpacing: '0.06em', fontSize: 10,
          textTransform: 'uppercase',
        }}>
          <input
            type="checkbox"
            checked={showIliquidas}
            onChange={(e) => setShowIliquidas(e.target.checked)}
            style={{ margin: 0 }}
          />
          Mostrar ilíquidas ({signalsIliquid.length})
        </label>
      </div>

      {/* ─── Conviction summary strip ─────────────────────────── */}
      <ConvictionSummary signals={signalsOperable} />

      {/* ─── Signal cards ─────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {visibleSignals.map((sig) => (
          <SignalCard
            key={`${sig.tipo}-${sig.instrumento}`}
            sig={sig}
            onClick={() => setSelected(sig)}
          />
        ))}
      </div>

      {/* ─── Drawer con playbook ──────────────────────────────── */}
      <PlaybookDrawer
        signal={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function ConvictionSummary({ signals }: { signals: SignalRow[] }) {
  const counts = {
    ALTA: signals.filter((s) => s.conviccion === 'ALTA').length,
    MEDIA: signals.filter((s) => s.conviccion === 'MEDIA').length,
    BAJA: signals.filter((s) => s.conviccion === 'BAJA').length,
  };
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 0,
      border: `1px solid ${T.hairline}`,
      background: T.surface,
      marginBottom: 8,
    }}>
      <SummaryCell label="Convicción ALTA" count={counts.ALTA} accent={T.green} />
      <SummaryCell label="Convicción MEDIA" count={counts.MEDIA} accent={T.accent} />
      <SummaryCell label="Convicción BAJA" count={counts.BAJA} accent={T.muted} />
    </div>
  );
}

function SummaryCell({
  label, count, accent,
}: {
  label: string; count: number; accent: string;
}) {
  return (
    <div style={{
      padding: '10px 14px',
      borderRight: `1px solid ${T.hairlineSoft}`,
      fontFamily: MONO,
      display: 'flex', alignItems: 'baseline', gap: 8,
    }}>
      <span style={{
        fontSize: 22, fontWeight: 700, color: accent,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {count}
      </span>
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.14em',
        color: T.muted, textTransform: 'uppercase',
      }}>
        {label}
      </span>
    </div>
  );
}

function SignalCard({
  sig,
  onClick,
}: {
  sig: SignalRow;
  onClick: () => void;
}) {
  const isIliquid = sig.liquidez === 'ILIQUIDA';
  const isMarginal = sig.liquidez === 'MARGINAL';

  // Border-left por conviccion + dashed para MEDIA
  let borderColor: string = T.muted;
  if (sig.conviccion === 'ALTA') borderColor = T.green;
  else if (sig.conviccion === 'MEDIA') borderColor = T.accent;
  const borderStyle = sig.conviccion === 'MEDIA' ? 'dashed' : 'solid';

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '4px 90px 1fr 100px 120px 140px 32px',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        background: T.surface,
        border: `1px solid ${T.hairline}`,
        borderLeft: `4px ${borderStyle} ${borderColor}`,
        cursor: 'pointer',
        fontFamily: MONO,
        textAlign: 'left',
        width: '100%',
        opacity: isIliquid ? 0.5 : 1,
        transition: 'background 80ms ease, border-color 80ms ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = T.surfaceAlt; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = T.surface; }}
    >
      {/* Empty 4px column = where the border-left lives */}
      <div />

      {/* Tipo */}
      <div>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.14em',
          color: T.muted, textTransform: 'uppercase',
        }}>
          {sig.tipo}
        </span>
      </div>

      {/* Instrumento + senal */}
      <div>
        <span style={{
          fontSize: 13, fontWeight: 700, color: T.ink,
          letterSpacing: '0.02em',
        }}>
          {sig.instrumento}
        </span>
        <span style={{
          marginLeft: 10, fontSize: 11, fontWeight: 600,
          color: senalColor(sig.senal),
          letterSpacing: '0.04em',
        }}>
          {sig.senal}
        </span>
      </div>

      {/* Z-Score */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 9, color: T.muted, letterSpacing: '0.1em' }}>
          Z-SCORE
        </div>
        <div style={{
          fontSize: 14, fontWeight: 700, color: T.ink,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {fmtSigned(sig.z_score, 2)}
        </div>
      </div>

      {/* Score ajustado */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 9, color: T.muted, letterSpacing: '0.1em' }}>
          SCORE AJUSTADO
        </div>
        <div style={{
          fontSize: 14, fontWeight: 700,
          color: isIliquid ? T.red : T.ink,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {sig.score_ajustado.toFixed(2)}
          <span style={{ fontSize: 9, color: T.muted, marginLeft: 4 }}>
            (raw {sig.score.toFixed(2)})
          </span>
        </div>
      </div>

      {/* Liquidez badge + conviccion */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
          padding: '2px 6px',
          background: liquidezBg(sig.liquidez),
          color: liquidezColor(sig.liquidez),
          textTransform: 'uppercase',
        }}>
          <Icon icon={liquidezIcon(sig.liquidez)} style={{ marginRight: 4, fontSize: 8 }} />
          {sig.liquidez}
        </span>
        <span style={{
          fontSize: 9, fontWeight: 600, letterSpacing: '0.08em',
          color: convColor(sig.conviccion),
          textTransform: 'uppercase',
        }}>
          {sig.conviccion}
        </span>
      </div>

      {/* Chevron */}
      <div style={{ color: T.mutedDim, textAlign: 'right' }}>
        <Icon icon={faChevronRight} style={{ fontSize: 10 }} />
      </div>

      {/* Marginal warning row */}
      {isMarginal && (
        <div style={{
          gridColumn: '2 / -1',
          marginTop: 6,
          fontSize: 10,
          color: T.accent,
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}>
          <Icon icon={faExclamationTriangle} className="me-1" />
          MARGINAL — pata {sig.bottleneck || 'n/d'}: {sig.motivo_bottleneck || 'cerca del umbral'}
        </div>
      )}
    </button>
  );
}

function senalColor(senal: string): string {
  if (senal.includes('VENDER')) return T.red;
  if (senal.includes('COMPRAR')) return T.green;
  if (senal === 'STEEP') return T.blue;
  if (senal === 'FLAT') return T.purple;
  return T.muted;
}

function convColor(conv: string): string {
  if (conv === 'ALTA') return T.green;
  if (conv === 'MEDIA') return T.accent;
  return T.muted;
}

function liquidezColor(liq: string): string {
  if (liq === 'LIQUIDA') return T.green;
  if (liq === 'MARGINAL') return T.accent;
  return T.red;
}

function liquidezBg(liq: string): string {
  if (liq === 'LIQUIDA') return T.greenSoft;
  if (liq === 'MARGINAL') return T.accentSoft;
  return T.redSoft;
}

function liquidezIcon(liq: string) {
  if (liq === 'LIQUIDA') return faCheckCircle;
  return faExclamationTriangle;
}
