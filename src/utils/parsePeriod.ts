/**
 * parsePeriod — convierte texto en lenguaje natural (ES/EN) en un rango
 * de fechas {from, to}. Usado por /api/resolver/chart-direct cuando el
 * usuario no pasa un periodo explícito en la barra de búsqueda.
 *
 * No-LLM, deterministic — para entender "hoy" / "ayer" / "últimos 30 días"
 * sin pagar un round-trip a Anthropic.
 *
 * Para casos que no matchea ninguna regla, devuelve el default
 * (last 365 days). El caller puede inspeccionar `matched` para saber si
 * el parser realmente entendió.
 */

export interface ParsedPeriod {
  from: Date;
  to: Date;
  /** "hoy" | "ayer" | "last_N_days" | "month YYYY" | "year YYYY" | "default" | ... */
  matched: string;
  /** Días entre from y to (inclusive). */
  period_days: number;
}

const MONTH_NAMES_ES: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
  ene: 0, feb: 1, mar: 2, abr: 3, jun: 5,
  jul: 6, ago: 7, sep: 8, sept: 8, oct: 9, nov: 10, dic: 11,
};
const MONTH_NAMES_EN: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, mar2: 2, apr: 3, jun2: 5, jul2: 6, aug: 7, sept2: 8, oct2: 9, dec: 11,
};
const MONTH_NAMES: Record<string, number> = { ...MONTH_NAMES_ES, ...MONTH_NAMES_EN };

const UNIT_DAYS: Record<string, number> = {
  dia: 1, dias: 1, día: 1, días: 1, day: 1, days: 1,
  semana: 7, semanas: 7, week: 7, weeks: 7,
  mes: 30, meses: 30, month: 30, months: 30,
  año: 365, años: 365, anio: 365, anios: 365, ano: 365, anos: 365,
  year: 365, years: 365, yr: 365, yrs: 365,
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function daysBetween(from: Date, to: Date): number {
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000));
}

function build(from: Date, to: Date, matched: string): ParsedPeriod {
  return { from: startOfDay(from), to: endOfDay(to), matched, period_days: daysBetween(from, to) };
}

/** Strip diacritics so "última" matches "ultim[oa]?", etc. */
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function tryParseDate(s: string): Date | null {
  const trimmed = s.trim();
  // ISO
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const d = new Date(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));
    if (!Number.isNaN(d.getTime())) return d;
  }
  // DD/MM/YYYY
  const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const d = new Date(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10));
    if (!Number.isNaN(d.getTime())) return d;
  }
  // YYYY
  if (/^\d{4}$/.test(trimmed)) {
    return new Date(parseInt(trimmed, 10), 0, 1);
  }
  return null;
}

export function parsePeriod(
  text: string | null | undefined,
  now: Date = new Date(),
): ParsedPeriod {
  const today = startOfDay(now);
  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - 365);
  const defaultPeriod = build(defaultFrom, today, 'default');

  if (!text || typeof text !== 'string') return defaultPeriod;
  const t = stripAccents(text.toLowerCase()).trim();
  if (!t) return defaultPeriod;

  // ── "hoy" / "today" ──
  if (/^(hoy|today)$/.test(t)) {
    return build(today, today, 'today');
  }

  // ── "ayer" / "yesterday" ──
  if (/^(ayer|yesterday)$/.test(t)) {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return build(y, y, 'yesterday');
  }

  // ── YTD ──
  if (/^(ytd|year[- ]to[- ]date)$/.test(t)) {
    const ytdFrom = new Date(today.getFullYear(), 0, 1);
    return build(ytdFrom, today, 'ytd');
  }

  // ── "última semana/mes/año" / "last week/month/year" ──
  const lastUnit = t.match(/^(ultim[oa]?|last)\s+(\w+)$/);
  if (lastUnit) {
    const unit = lastUnit[2].toLowerCase();
    const days = UNIT_DAYS[unit];
    if (days) {
      const from = new Date(today);
      from.setDate(from.getDate() - days);
      return build(from, today, `last_${unit}`);
    }
  }

  // ── "últimos N días/semanas/meses/años" / "last N <unit>" ──
  const lastN = t.match(/^(ultim[oa]s?|last|past)\s+(\d+)\s+(\w+)$/);
  if (lastN) {
    const n = parseInt(lastN[2], 10);
    const unit = lastN[3].toLowerCase();
    const dayMult = UNIT_DAYS[unit];
    if (dayMult && n > 0 && n <= 50) {
      const days = n * dayMult;
      const from = new Date(today);
      from.setDate(from.getDate() - days);
      return build(from, today, `last_${n}_${unit}`);
    }
  }

  // ── "desde DD/MM/YYYY" or "desde YYYY-MM-DD" ──
  const since = t.match(/^(desde|from|since)\s+(.+)$/);
  if (since) {
    const sinceDate = tryParseDate(since[2]);
    if (sinceDate) return build(sinceDate, today, 'since');
  }

  // ── "MMMM YYYY" or "YYYY MMMM" (month + year) ──
  const monthYear = t.match(/^(\w+)\s+(\d{4})$/) || t.match(/^(\d{4})\s+(\w+)$/);
  if (monthYear) {
    const [, first, second] = monthYear;
    const yearFirst = /^\d/.test(first);
    const monthStr = yearFirst ? second : first;
    const yearStr = yearFirst ? first : second;
    const monthIdx = MONTH_NAMES[monthStr.toLowerCase()];
    const year = parseInt(yearStr, 10);
    if (monthIdx !== undefined && !Number.isNaN(year) && year >= 1900 && year <= 2100) {
      const from = new Date(year, monthIdx, 1);
      const to = new Date(year, monthIdx + 1, 0);
      return build(from, to, 'month_year');
    }
  }

  // ── "QN YYYY" (quarter) ──
  const qFirst = t.match(/^q([1-4])\s+(\d{4})$/);
  const qLast = t.match(/^(\d{4})\s+q([1-4])$/);
  if (qFirst || qLast) {
    const q = qFirst ? parseInt(qFirst[1], 10) : parseInt((qLast as RegExpMatchArray)[2], 10);
    const year = qFirst ? parseInt(qFirst[2], 10) : parseInt((qLast as RegExpMatchArray)[1], 10);
    const fromMonth = (q - 1) * 3;
    const from = new Date(year, fromMonth, 1);
    const to = new Date(year, fromMonth + 3, 0);
    return build(from, to, `q${q}_${year}`);
  }

  // ── "YYYY" only (full year) ──
  if (/^\d{4}$/.test(t)) {
    const year = parseInt(t, 10);
    if (year >= 1900 && year <= 2100) {
      return build(new Date(year, 0, 1), new Date(year, 11, 31), 'year');
    }
  }

  // ── "YYYY-MM-DD" specific date ──
  const isoDate = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoDate) {
    const d = new Date(parseInt(isoDate[1], 10), parseInt(isoDate[2], 10) - 1, parseInt(isoDate[3], 10));
    if (!Number.isNaN(d.getTime())) return build(d, d, 'date');
  }

  // ── "DD/MM/YYYY" or "MM/DD/YYYY" (assume DD/MM for ES) ──
  const slashDate = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashDate) {
    const d = new Date(parseInt(slashDate[3], 10), parseInt(slashDate[2], 10) - 1, parseInt(slashDate[1], 10));
    if (!Number.isNaN(d.getTime())) return build(d, d, 'date');
  }

  // ── "DD/MM/YYYY - DD/MM/YYYY" range ──
  const rangeStr = t.match(/^(.+)\s+(?:a|to|hasta|-)\s+(.+)$/);
  if (rangeStr) {
    const fromD = tryParseDate(rangeStr[1].trim());
    const toD = tryParseDate(rangeStr[2].trim());
    if (fromD && toD) return build(fromD, toD, 'range');
  }

  // Nothing matched → default
  return defaultPeriod;
}
