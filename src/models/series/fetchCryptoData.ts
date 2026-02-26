import { LightSerieValue } from 'src/types/lightserie';

const BASE_URL = 'https://min-api.cryptocompare.com/data/v2/histoday';
const MAX_LIMIT = 2000;

export const CRYPTO_SYMBOLS = new Set([
  'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT',
  'MATIC', 'LINK', 'BNB', 'LTC', 'UNI', 'ATOM', 'NEAR',
  'APT', 'ARB', 'OP', 'FTM', 'ALGO',
]);

export type CryptoDataResponse = {
  data: LightSerieValue[] | undefined;
  error: string | undefined;
};

export const isCryptoPair = (from: string, to: string): boolean =>
  CRYPTO_SYMBOLS.has(from) || CRYPTO_SYMBOLS.has(to);

export const fetchCryptoData = async (
  fromSymbol: string,
  toSymbol: string
): Promise<CryptoDataResponse> => {
  const response: CryptoDataResponse = {
    data: undefined,
    error: undefined,
  };

  try {
    const url = `${BASE_URL}?fsym=${fromSymbol}&tsym=${toSymbol}&limit=${MAX_LIMIT}`;
    const res = await fetch(url);
    const json = await res.json();

    if (json.Response !== 'Success' || !json.Data?.Data) {
      response.error = json.Message || 'Error al cargar datos de crypto';
      return response;
    }

    const points: LightSerieValue[] = json.Data.Data
      .filter((d: { close: number }) => d.close > 0)
      .map((d: { time: number; close: number }) => {
        const date = new Date(d.time * 1000);
        const yyyy = date.getUTCFullYear();
        const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(date.getUTCDate()).padStart(2, '0');
        return {
          time: `${yyyy}-${mm}-${dd}`,
          value: d.close,
        };
      });

    response.data = points;
    return response;
  } catch (e) {
    response.error = 'Error al cargar datos de crypto';
    return response;
  }
};
