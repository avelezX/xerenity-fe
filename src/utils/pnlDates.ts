import { fetchHistoricalMark } from 'src/models/trading/fetchHistoricalMark';

export type PnlRefDates = {
  daily: string | null;  // ayer hábil
  mtd: string | null;    // último día hábil del mes anterior
  ytd: string | null;    // último día hábil de diciembre del año anterior
};

function prevBusinessDay(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  do {
    d.setDate(d.getDate() - 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return d.toISOString().slice(0, 10);
}

function lastBizDayOfPrevMonth(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(0); // day 0 of current month = last day of previous month
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }
  return d.toISOString().slice(0, 10);
}

function lastBizDayOfPrevDecember(dateStr: string): string {
  const year = parseInt(dateStr.slice(0, 4), 10);
  const d = new Date(year - 1, 11, 31); // 31 de dic del año anterior
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Dado una fecha de valoración, calcula las tres fechas de referencia P&L
 * y valida que cada una tenga marca 'complete' disponible.
 * Retorna null para los periodos sin marca completa.
 */
export async function computePnlRefDates(fechaMarca: string): Promise<PnlRefDates> {
  const candidateDaily = prevBusinessDay(fechaMarca);
  const candidateMtd = lastBizDayOfPrevMonth(fechaMarca);
  const candidateYtd = lastBizDayOfPrevDecember(fechaMarca);

  const [dailyMark, mtdMark, ytdMark] = await Promise.all([
    fetchHistoricalMark(candidateDaily),
    fetchHistoricalMark(candidateMtd),
    fetchHistoricalMark(candidateYtd),
  ]);

  return {
    daily: dailyMark.status === 'complete' ? candidateDaily : null,
    mtd: mtdMark.status === 'complete' ? candidateMtd : null,
    ytd: ytdMark.status === 'complete' ? candidateYtd : null,
  };
}
