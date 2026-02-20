/**
 * Central bank meeting dates for rate path calculations.
 * Only includes meetings where monetary policy rate decisions are made.
 * Update annually when new schedules are published.
 */

// FOMC 2025-2029 meeting dates (announcement day = 2nd day of 2-day meeting)
// 2025-2026: confirmed from https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
// 2027-2029: projected (FOMC meets 8x/year, pattern: late-Jan, mid-Mar, early-May,
//            mid-Jun, late-Jul, mid-Sep, late-Oct, mid-Dec)
export const FOMC_MEETINGS: string[] = [
  // 2025 (confirmed)
  '2025-01-29',
  '2025-03-19',
  '2025-05-07',
  '2025-06-18',
  '2025-07-30',
  '2025-09-17',
  '2025-10-29',
  '2025-12-10',
  // 2026 (confirmed)
  '2026-01-28',
  '2026-03-18',
  '2026-04-29',
  '2026-06-17',
  '2026-07-29',
  '2026-09-16',
  '2026-10-28',
  '2026-12-09',
  // 2027 (projected)
  '2027-01-27',
  '2027-03-17',
  '2027-05-05',
  '2027-06-16',
  '2027-07-28',
  '2027-09-15',
  '2027-10-27',
  '2027-12-15',
  // 2028 (projected)
  '2028-01-26',
  '2028-03-15',
  '2028-05-03',
  '2028-06-14',
  '2028-07-26',
  '2028-09-13',
  '2028-10-25',
  '2028-12-13',
  // 2029 (projected)
  '2029-01-31',
  '2029-03-21',
  '2029-05-02',
  '2029-06-13',
  '2029-07-25',
  '2029-09-12',
  '2029-10-31',
  '2029-12-12',
];

// BanRep 2025-2029 rate decision meetings (8 per year)
// Rate decisions: Jan, Mar, Apr, Jun, Jul, Sep, Oct, Dec
// Excludes Feb, May, Aug, Nov regular administrative meetings
// 2025-2026: approximate from https://www.banrep.gov.co/es/calendario-junta-directiva
// 2027-2029: projected (last Friday of the decision month)
export const BANREP_MEETINGS: string[] = [
  // 2025
  '2025-01-31',
  '2025-03-28',
  '2025-04-30',
  '2025-06-27',
  '2025-07-31',
  '2025-09-26',
  '2025-10-31',
  '2025-12-19',
  // 2026
  '2026-01-30',
  '2026-03-31',
  '2026-04-30',
  '2026-06-30',
  '2026-07-31',
  '2026-09-30',
  '2026-10-30',
  '2026-12-18',
  // 2027 (projected)
  '2027-01-29',
  '2027-03-26',
  '2027-04-30',
  '2027-06-25',
  '2027-07-30',
  '2027-09-24',
  '2027-10-29',
  '2027-12-17',
  // 2028 (projected)
  '2028-01-28',
  '2028-03-31',
  '2028-04-28',
  '2028-06-30',
  '2028-07-28',
  '2028-09-29',
  '2028-10-27',
  '2028-12-15',
  // 2029 (projected)
  '2029-01-26',
  '2029-03-30',
  '2029-04-27',
  '2029-06-29',
  '2029-07-27',
  '2029-09-28',
  '2029-10-26',
  '2029-12-14',
];
