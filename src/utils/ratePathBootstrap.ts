/**
 * OIS forward rate bootstrap for implied central bank rate paths.
 *
 * Given an OIS swap curve and current overnight rate, extracts the
 * market-implied overnight rate at each future central bank meeting.
 *
 * Math: OIS rate R(T) = (1/T) * Σ(r_i * d_i) where r_i is the
 * overnight rate in inter-meeting period i and d_i is its day fraction.
 * We bootstrap r_i sequentially from short to long tenors.
 */

export type OISPoint = { tenor_months: number; rate: number };

export type RatePathPoint = {
  meeting_date: string;
  implied_rate: number;
  implied_change_bps: number;
  cumulative_change_bps: number;
  ois_rate_at_meeting: number;
};

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function monthsBetweenDates(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return (
    (b.getFullYear() - a.getFullYear()) * 12 +
    (b.getMonth() - a.getMonth()) +
    (b.getDate() - a.getDate()) / 30
  );
}

/**
 * Linear interpolation on the OIS curve at an arbitrary month value.
 * Returns null if months is outside the curve range.
 */
export function interpolateOIS(
  curve: OISPoint[],
  months: number
): number | null {
  if (curve.length < 2) return null;
  if (months < curve[0].tenor_months || months > curve[curve.length - 1].tenor_months) {
    return null;
  }

  const exact = curve.find((p) => Math.abs(p.tenor_months - months) < 0.001);
  if (exact) return exact.rate;

  let idx = -1;
  curve.forEach((p, i) => {
    if (
      i < curve.length - 1 &&
      months > p.tenor_months &&
      months < curve[i + 1].tenor_months
    ) {
      idx = i;
    }
  });
  if (idx === -1) return null;

  const t =
    (months - curve[idx].tenor_months) /
    (curve[idx + 1].tenor_months - curve[idx].tenor_months);
  return curve[idx].rate + t * (curve[idx + 1].rate - curve[idx].rate);
}

/**
 * Bootstrap the implied overnight rate path from an OIS swap curve.
 *
 * @param curve - OIS par swap rates sorted by tenor_months ascending, rates in %
 * @param currentRate - Current overnight rate in % (e.g. 4.33 for SOFR, 9.25 for IBR)
 * @param meetingDates - Array of YYYY-MM-DD strings for future meetings
 * @param curveDate - YYYY-MM-DD of the curve observation date
 * @param dayBasis - Day count basis (360 for SOFR/IBR OIS, default 360)
 * @returns Array of RatePathPoint for each meeting within the curve's tenor range
 */
export function bootstrapRatePath(
  curve: OISPoint[],
  currentRate: number,
  meetingDates: string[],
  curveDate: string,
  dayBasis: number = 360
): RatePathPoint[] {
  if (curve.length < 2) return [];

  // Filter to future meetings only
  const futureMeetings = meetingDates.filter((d) => d > curveDate);
  if (futureMeetings.length === 0) return [];

  // Max tenor we can interpolate (in months)
  const maxTenor = curve[curve.length - 1].tenor_months;

  // Pre-filter to meetings we can actually interpolate.
  // This prevents index misalignment when meetings are skipped.
  type ValidMeeting = {
    date: string;
    oisRate: number;
    totalDays: number;
  };
  const validMeetings: ValidMeeting[] = [];
  futureMeetings.forEach((meetingDate) => {
    const monthsToMeeting = monthsBetweenDates(curveDate, meetingDate);
    if (monthsToMeeting > maxTenor) return;
    if (monthsToMeeting < 0.1) return;

    const oisRate = interpolateOIS(curve, monthsToMeeting);
    if (oisRate == null) return;

    const totalDays = daysBetween(curveDate, meetingDate);
    if (totalDays <= 0) return;

    validMeetings.push({ date: meetingDate, oisRate, totalDays });
  });

  if (validMeetings.length === 0) return [];

  const result: RatePathPoint[] = [];
  let prevRate = currentRate;

  // Track cumulative weighted rate*days from curve date
  // OIS_rate(T) * T_days = sum of (r_i * days_i) for all periods from curveDate to T
  let cumulativeRateDays = 0;

  // "Periods" are: [curveDate → meeting1], [meeting1 → meeting2], ...
  // The overnight rate in each period is what we solve for.
  // For the first valid meeting, periodStart is always curveDate.

  validMeetings.forEach((meeting, i) => {
    const periodStart = i === 0 ? curveDate : validMeetings[i - 1].date;
    const periodDays = daysBetween(periodStart, meeting.date);

    if (periodDays <= 0) return;

    // OIS equation: oisRate * totalDays / dayBasis
    //   = cumulativeRateDays + impliedRate * periodDays / dayBasis
    // Solve for impliedRate:
    const oisWeightedTotal = (meeting.oisRate * meeting.totalDays) / dayBasis;
    const impliedRate =
      ((oisWeightedTotal - cumulativeRateDays) * dayBasis) / periodDays;

    // Update cumulative tracking
    cumulativeRateDays = oisWeightedTotal;

    const changeBps = Math.round((impliedRate - prevRate) * 100);
    const cumulativeChangeBps = Math.round((impliedRate - currentRate) * 100);

    result.push({
      meeting_date: meeting.date,
      implied_rate: Math.round(impliedRate * 10000) / 10000,
      implied_change_bps: changeBps,
      cumulative_change_bps: cumulativeChangeBps,
      ois_rate_at_meeting: Math.round(meeting.oisRate * 10000) / 10000,
    });

    prevRate = impliedRate;
  });

  return result;
}

/**
 * Format a meeting date as short label: "Mar'26"
 */
export function formatMeetingDate(dateStr: string): string {
  const d = new Date(dateStr);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const yr = String(d.getFullYear()).slice(2);
  return `${months[d.getMonth()]}'${yr}`;
}

/**
 * Format basis points change as string: "+25", "-50", "UNCH"
 */
export function formatBpsChange(bps: number): string {
  if (bps === 0) return 'UNCH';
  return bps > 0 ? `+${bps}` : `${bps}`;
}
