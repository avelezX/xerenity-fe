import { getMarkByDate } from 'src/models/pricing/pricingApi';
import type { HistoricalMark } from 'src/types/trading';

/**
 * Fetches historical market data for a given fecha (YYYY-MM-DD).
 * Single source of truth: market_marks table via GET /pricing/marks?fecha=.
 */
// eslint-disable-next-line import/prefer-default-export
export const fetchHistoricalMark = async (
  fecha: string // 'YYYY-MM-DD'
): Promise<HistoricalMark> => {
  const { mark } = await getMarkByDate(fecha);

  if (!mark) {
    return {
      fecha,
      status: 'missing',
      fx_spot: null,
      sofr_on: null,
      ibr: null,
      sofr: null,
      ndf: null,
      hasIbr: false,
      hasSofr: false,
      hasNdf: false,
    };
  }

  const ibr = mark.ibr ?? null;
  const sofr = mark.sofr ?? null;
  const ndf = mark.ndf ?? null;

  return {
    fecha: mark.fecha,
    status: mark.status,
    fx_spot: mark.fx_spot,
    sofr_on: mark.sofr_on,
    ibr,
    sofr,
    ndf,
    hasIbr: ibr != null && Object.values(ibr).some((v) => v != null),
    hasSofr: sofr != null && Object.values(sofr).some((v) => v != null),
    hasNdf: ndf != null && Object.values(ndf).some((v) => v?.F_market != null),
  };
};
