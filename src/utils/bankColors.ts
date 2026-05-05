/**
 * Deterministic color assignment per bank name.
 *
 * Same bank always maps to the same color across renders, sessions, and
 * components. Used by the Créditos charts (debt curve, cheapest-bank).
 *
 * Strategy:
 *  1. Hardcoded overrides for the major Colombian banks the user expects
 *     to recognize at a glance — match by case-insensitive substring so
 *     name variations ("BANCOLOMBIA S.A.", "Banco Bancolombia") all hit.
 *  2. For everything else, an FNV-1a 32-bit hash of the bank name modulo a
 *     curated palette. The palette excludes hues already taken by the
 *     overrides so a "Bancoldex" never accidentally turns out red and
 *     looks like Davivienda.
 */
import { XerenityHexColors } from './getHexColors';

interface BankColorOverride {
  match: RegExp;
  color: string;
  /** Used by tests / docs only — not surfaced anywhere. */
  label: string;
}

/** Order matters: first match wins. Use specific patterns first. */
const BANK_OVERRIDES: BankColorOverride[] = [
  { match: /bancolombia/i, color: '#D4A017', label: 'Bancolombia (dorado)' },
  { match: /davivienda/i, color: '#E11D48', label: 'Davivienda (rojo)' },
  { match: /santander/i, color: '#F87171', label: 'Santander (rojo claro)' },
  { match: /\bbbva\b/i, color: '#0B1F8C', label: 'BBVA (azul oscuro)' },
  {
    match: /banco\s*de\s*bogot[áa]?|^bogot[áa]/i,
    color: '#3B82F6',
    label: 'Banco de Bogotá (azul claro)',
  },
];

/**
 * Curated palette for non-override banks. Avoids the hues used above
 * (gold, deep red, coral, navy, sky) so the colors stay distinguishable.
 */
const FALLBACK_PALETTE = [
  '#16A34A', // verde
  '#9333EA', // morado
  '#EA580C', // naranja
  '#0D9488', // teal
  '#DB2777', // fucsia
  '#65A30D', // lima
  '#0891B2', // cyan
  '#92400E', // marrón
  '#4338CA', // índigo
  '#475569', // gris pizarra
  '#7C3AED', // violeta
  '#059669', // verde esmeralda
  '#C026D3', // magenta
  '#A16207', // ocre
  '#1F2937', // grafito
];

/* eslint-disable no-bitwise */
function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}
/* eslint-enable no-bitwise */

export function getBankColor(bank: string): string {
  const name = (bank || 'unknown').trim();
  if (!name) return FALLBACK_PALETTE[0];

  const override = BANK_OVERRIDES.find((o) => o.match.test(name));
  if (override) return override.color;

  const idx = fnv1a32(name.toLowerCase()) % FALLBACK_PALETTE.length;
  return FALLBACK_PALETTE[idx];
}

/** Re-exported so existing callers that imported the legacy palette
 *  alongside this util keep compiling. */
export { XerenityHexColors };

export default getBankColor;
