/**
 * Helpers centralizados de fechas para el módulo de Riesgos.
 *
 * Convenciones:
 *   - El "wire format" es ISO string `"YYYY-MM-DD"` (sin hora, sin tz).
 *   - Las funciones que reciben `Date` NUNCA lo mutan; siempre retornan un Date nuevo.
 *   - `parseISOAsNoon` ancla la fecha al mediodía UTC para evitar bugs
 *     de timezone shift cuando se construye un Date desde un string ISO.
 *
 * Este módulo reemplaza las copias dispersas de `lastBusinessDay`,
 * `lastDayOfMonth`, `currentMonth`, etc. que vivían en risk-resumen,
 * risk-management, futuresCalculator y riskApi.
 */

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

export const MONTH_NAMES_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
] as const;

// ─────────────────────────────────────────────────────────────────
// Parse / format
// ─────────────────────────────────────────────────────────────────

/**
 * Convierte ISO string `"YYYY-MM-DD"` a Date anclado al mediodía UTC.
 * Esto evita que `new Date("2026-03-15")` se interprete como medianoche
 * UTC (puede dar día anterior en Colombia) o medianoche local (puede
 * dar día siguiente en UTC).
 */
export function parseISOAsNoon(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00Z`);
}

/**
 * Date → ISO string `"YYYY-MM-DD"` (UTC-safe vía toISOString().slice).
 * Siempre 10 chars exactos.
 */
export function formatISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * "Marzo 2026" — label legible para selectores y headers.
 */
export function formatMonthLabel(d: Date): string {
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * "Marzo 2026 (último día hábil: 31-mar)" — variante extendida.
 */
export function formatMonthLabelExtended(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, '0');
  const monthShort = MONTH_NAMES_SHORT[d.getUTCMonth()];
  return `${formatMonthLabel(d)} (último día hábil: ${day}-${monthShort})`;
}

// ─────────────────────────────────────────────────────────────────
// Calendario (sin festivos por ahora — solo fines de semana)
// ─────────────────────────────────────────────────────────────────

/**
 * Retorna el último día hábil <= la fecha dada. Inmutable.
 * Si cae sábado/domingo, retrocede al viernes.
 * NOTA: aún no respeta festivos colombianos — TODO.
 */
export function lastBusinessDay(d: Date): Date {
  const result = new Date(d.getTime());
  const day = result.getUTCDay();
  if (day === 0) {          // domingo → viernes
    result.setUTCDate(result.getUTCDate() - 2);
  } else if (day === 6) {   // sábado → viernes
    result.setUTCDate(result.getUTCDate() - 1);
  }
  return result;
}

/**
 * Último día hábil del mes al que pertenece la fecha dada.
 * Ej: lastBusinessDayOfMonth(2026-03-15) → 2026-03-31 (martes hábil).
 */
export function lastBusinessDayOfMonth(d: Date): Date {
  // Primer día del mes siguiente, menos un día = último del mes actual
  const eom = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12, 0, 0));
  return lastBusinessDay(eom);
}

/**
 * Último día hábil del mes anterior al de la fecha dada.
 * Ej: lastBusinessDayOfPrevMonth(2026-04-15) → 2026-03-31.
 *
 * Reemplaza las copias duplicadas en futuresCalculator.ts y riskApi.ts.
 */
export function lastBusinessDayOfPrevMonth(d: Date): Date {
  // Día 0 del mes actual = último día del mes anterior
  const eomPrev = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0, 12, 0, 0));
  return lastBusinessDay(eomPrev);
}

/**
 * Primer día hábil del mes al que pertenece la fecha dada.
 */
export function firstBusinessDayOfMonth(d: Date): Date {
  const result = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12, 0, 0));
  const day = result.getUTCDay();
  if (day === 6) result.setUTCDate(result.getUTCDate() + 2);  // sábado → lunes
  else if (day === 0) result.setUTCDate(result.getUTCDate() + 1); // domingo → lunes
  return result;
}

// ─────────────────────────────────────────────────────────────────
// "Hoy" en Bogotá
// ─────────────────────────────────────────────────────────────────

/**
 * Hoy en zona horaria de Bogotá como Date anclado al mediodía UTC.
 * Útil para inicializar selectores sin riesgo de off-by-one entre
 * 19:00 y 00:00 hora Colombia (cuando UTC ya está en el día siguiente).
 */
export function todayBogota(): Date {
  // Trick: usar Intl con timeZone Bogotá para extraer el día local,
  // luego construir UTC noon de ese día.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = fmt.format(new Date()); // "2026-05-15"
  return parseISOAsNoon(parts);
}

/**
 * Default razonable para `globalEvaluationDate`:
 * último día hábil del mes corriente (Bogotá).
 */
export function defaultEvaluationDate(): Date {
  return lastBusinessDayOfMonth(todayBogota());
}

// ─────────────────────────────────────────────────────────────────
// Navegación de meses (para selectores tipo `< Marzo 2026 >`)
// ─────────────────────────────────────────────────────────────────

/**
 * Mes anterior (preservando el último día hábil del mes).
 */
export function prevMonth(d: Date): Date {
  const ref = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 15, 12, 0, 0));
  return lastBusinessDayOfMonth(ref);
}

/**
 * Mes siguiente (preservando el último día hábil del mes).
 */
export function nextMonth(d: Date): Date {
  const ref = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 15, 12, 0, 0));
  return lastBusinessDayOfMonth(ref);
}
