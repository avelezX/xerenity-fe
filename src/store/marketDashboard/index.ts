import { StateCreator } from 'zustand';
import {
  WatchlistEntry,
  WatchlistGroup,
  ChartSelection,
  TimePeriod,
  DashboardConfig,
  FicFundEntry,
} from 'src/types/watchlist';
import { LightSerieValue } from 'src/types/lightserie';
import {
  fetchWatchlistMetadata,
  fetchLatestValuesBatch,
} from 'src/models/series/fetchWatchlistSnapshot';
import { fetchSeriesData } from 'src/models/series/fetchSerieData';
import { fetchCurrencyPairData } from 'src/models/series/fetchCurrencyPairData';
import { fetchCryptoData, isCryptoPair } from 'src/models/series/fetchCryptoData';
import { getHexColor } from 'src/utils/getHexColors';

export const buildFicHierarchy = (entries: WatchlistEntry[]): FicFundEntry[] => {
  const map = new Map<string, FicFundEntry>();

  entries.forEach((entry) => {
    const codigoNegocio = entry.source_name.split('_')[0];
    const fondoName = entry.display_name.split(' Tipo de participacion:')[0].trim();

    if (!map.has(codigoNegocio)) {
      map.set(codigoNegocio, {
        codigoNegocio,
        fondoName,
        entidad: entry.entidad,
        subGroup: entry.sub_group,
        compartimentos: [],
        latestDate: null,
      });
    }
    map.get(codigoNegocio)!.compartimentos.push(entry);
  });

  Array.from(map.values()).forEach((fund) => {
    fund.compartimentos.sort(
      (a, b) =>
        Number(a.source_name.split('_').at(-1)) -
        Number(b.source_name.split('_').at(-1))
    );
    // eslint-disable-next-line no-param-reassign
    fund.latestDate = fund.compartimentos[0]?.latest_date ?? null;
  });

  return Array.from(map.values()).sort((a, b) =>
    a.fondoName.localeCompare(b.fondoName)
  );
};

export interface MarketDashboardSlice {
  watchlistEntries: WatchlistEntry[];
  watchlistGroups: WatchlistGroup[];
  watchlistLoading: boolean;
  valuesLoading: boolean;
  chartSelections: ChartSelection[];
  chartLoading: boolean;
  chartPeriod: TimePeriod;
  normalizeChart: boolean;
  normalizeDate: string;
  searchText: string;
  entidadFilter: string | undefined;
  activoFilter: boolean;
  tipoFondoFilter: string | undefined;
  claseActivoFilter: string | undefined;
  tamanoFondoFilter: string | undefined;
  tamanoInversionistasFilter: string | undefined;

  fetchWatchlistSnapshot: (config: DashboardConfig) => Promise<void>;
  addToChart: (entry: WatchlistEntry) => Promise<void>;
  addFundToChart: (compartimentos: WatchlistEntry[]) => Promise<void>;
  addCurrencyPairToChart: (pair: string) => Promise<void>;
  removeFromChart: (ticker: string) => void;
  clearChart: () => void;
  setChartPeriod: (period: TimePeriod) => void;
  setNormalizeChart: (normalize: boolean) => void;
  setNormalizeDate: (date: string) => void;
  setMarketSearchText: (text: string) => void;
  setEntidadFilter: (entidad: string | undefined) => void;
  setActivoFilter: (activo: boolean) => void;
  setTipoFondoFilter: (tipoFondo: string | undefined) => void;
  setClaseActivoFilter: (clase: string | undefined) => void;
  setTamanoFondoFilter: (tamano: string | undefined) => void;
  setTamanoInversionistasFilter: (tamano: string | undefined) => void;
  resetWatchlistOnly: () => void;
  resetMarketDashboard: () => void;
}

function groupEntries(
  entries: WatchlistEntry[],
  groupByField: DashboardConfig['groupByField']
): WatchlistGroup[] {
  const map = new Map<string, WatchlistEntry[]>();

  entries.forEach((entry) => {
    const key = entry[groupByField] || 'Otros';
    const existing = map.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      map.set(key, [entry]);
    }
  });

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, items]) => ({
      name,
      entries: items.sort((a, b) => a.display_name.localeCompare(b.display_name)),
    }));
}

function filterEntries(
  entries: WatchlistEntry[],
  searchText: string,
  entidadFilter: string | undefined,
  activoFilter: boolean,
  tipoFondoFilter: string | undefined,
  claseActivoFilter: string | undefined,
  tamanoFondoFilter: string | undefined,
  tamanoInversionistasFilter: string | undefined
): WatchlistEntry[] {
  let result = entries;

  if (searchText.length > 0) {
    const lower = searchText.toLowerCase();
    result = result.filter((e) =>
      e.display_name.toLowerCase().includes(lower)
    );
  }
  if (entidadFilter) {
    result = result.filter((e) => e.entidad === entidadFilter);
  }
  if (activoFilter) {
    result = result.filter((e) => e.activo !== false);
  }
  if (tipoFondoFilter) {
    result = result.filter((e) => e.tipo_fondo === tipoFondoFilter);
  }
  if (claseActivoFilter) {
    result = result.filter((e) => e.clase_activo === claseActivoFilter);
  }
  if (tamanoFondoFilter) {
    result = result.filter((e) => e.tamano_fondo === tamanoFondoFilter);
  }
  if (tamanoInversionistasFilter) {
    result = result.filter((e) => e.tamano_inversionistas === tamanoInversionistasFilter);
  }

  return result;
}

const initialMarketState = {
  watchlistEntries: [] as WatchlistEntry[],
  watchlistGroups: [] as WatchlistGroup[],
  watchlistLoading: false,
  valuesLoading: false,
  chartSelections: [] as ChartSelection[],
  chartLoading: false,
  chartPeriod: '1Y' as TimePeriod,
  normalizeChart: false,
  normalizeDate: '',
  searchText: '',
  entidadFilter: undefined as string | undefined,
  activoFilter: true,
  tipoFondoFilter: undefined as string | undefined,
  claseActivoFilter: undefined as string | undefined,
  tamanoFondoFilter: undefined as string | undefined,
  tamanoInversionistasFilter: undefined as string | undefined,
};

function getPeriodCutoff(period: TimePeriod): string | null {
  const now = new Date();
  switch (period) {
    case '1D':
      now.setDate(now.getDate() - 1);
      break;
    case '5D':
      now.setDate(now.getDate() - 5);
      break;
    case '1M':
      now.setMonth(now.getMonth() - 1);
      break;
    case '3M':
      now.setMonth(now.getMonth() - 3);
      break;
    case '6M':
      now.setMonth(now.getMonth() - 6);
      break;
    case 'YTD':
      return `${now.getFullYear()}-01-01`;
    case '1Y':
      now.setFullYear(now.getFullYear() - 1);
      break;
    case '3Y':
      now.setFullYear(now.getFullYear() - 3);
      break;
    case '5Y':
      now.setFullYear(now.getFullYear() - 5);
      break;
    case '10Y':
      now.setFullYear(now.getFullYear() - 10);
      break;
    default:
      return null;
  }
  return now.toISOString().split('T')[0];
}

const createMarketDashboardSlice: StateCreator<MarketDashboardSlice> = (
  set,
  get
) => ({
  ...initialMarketState,

  fetchWatchlistSnapshot: async (config: DashboardConfig) => {
    set({ watchlistLoading: true });

    const metaResponse = await fetchWatchlistMetadata(config.filters);

    if (metaResponse.error) {
      set({ watchlistLoading: false });
      return;
    }

    const entries = metaResponse.data;
    const groups = groupEntries(entries, config.groupByField);

    set({
      watchlistEntries: entries,
      watchlistGroups: groups,
      watchlistLoading: false,
      valuesLoading: true,
    });

    // Fetch latest values in background batches
    const tickers = entries.map((e) => e.ticker);
    const latestValues = await fetchLatestValuesBatch(tickers);

    set((state) => {
      const updated = state.watchlistEntries.map((e) => {
        const vals = latestValues.get(e.ticker);
        if (vals) {
          return {
            ...e,
            latest_value: vals.latest_value,
            latest_date: vals.latest_date,
            change: vals.change,
            pct_change: vals.pct_change,
          };
        }
        return e;
      });

      const filtered = filterEntries(
        updated,
        state.searchText,
        state.entidadFilter,
        state.activoFilter,
        state.tipoFondoFilter,
        state.claseActivoFilter,
        state.tamanoFondoFilter,
        state.tamanoInversionistasFilter
      );

      return {
        watchlistEntries: updated,
        watchlistGroups: groupEntries(filtered, config.groupByField),
        valuesLoading: false,
      };
    });
  },

  addToChart: async (entry: WatchlistEntry) => {
    const state = get();
    if (state.chartSelections.find((s) => s.ticker === entry.ticker)) {
      return;
    }

    set({ chartLoading: true });
    const color = getHexColor(state.chartSelections.length);

    const response = await fetchSeriesData({
      idSerie: entry.ticker,
      newColor: color,
    });

    if (response.data) {
      const fullSerieData = response.data.serie as LightSerieValue[];

      // Filter by period
      const cutoff = getPeriodCutoff(state.chartPeriod);
      const filteredData = cutoff
        ? fullSerieData.filter((d) => d.time >= cutoff)
        : fullSerieData;

      set((prev) => ({
        chartSelections: [
          ...prev.chartSelections,
          {
            ticker: entry.ticker,
            display_name: entry.display_name,
            color,
            fullData: fullSerieData,
            data: filteredData,
          },
        ],
        chartLoading: false,
      }));
    } else {
      set({ chartLoading: false });
    }
  },

  addFundToChart: (compartimentos: WatchlistEntry[]): Promise<void> =>
    compartimentos
      .reduce(
        (promise, entry) => promise.then(() => get().addToChart(entry)),
        Promise.resolve() as Promise<void>
      )
      .then(() => {
        get().setNormalizeChart(true);
      }),

  addCurrencyPairToChart: async (pair: string) => {
    const state = get();
    const tickerId = `currency_${pair}`;
    if (state.chartSelections.find((s) => s.ticker === tickerId)) {
      return;
    }

    set({ chartLoading: true });
    const color = getHexColor(state.chartSelections.length);

    const [fromSymbol, toSymbol] = pair.split(':');
    const useCrypto = isCryptoPair(fromSymbol, toSymbol);

    const response = useCrypto
      ? await fetchCryptoData(fromSymbol, toSymbol)
      : await fetchCurrencyPairData(pair);

    if (response.data) {
      const fullSerieData = response.data;

      const cutoff = getPeriodCutoff(state.chartPeriod);
      const filteredData = cutoff
        ? fullSerieData.filter((d) => d.time >= cutoff)
        : fullSerieData;

      set((prev) => ({
        chartSelections: [
          ...prev.chartSelections,
          {
            ticker: tickerId,
            display_name: pair,
            color,
            fullData: fullSerieData,
            data: filteredData,
          },
        ],
        chartLoading: false,
      }));
    } else {
      set({ chartLoading: false });
    }
  },

  removeFromChart: (ticker: string) => {
    set((state) => ({
      chartSelections: state.chartSelections.filter(
        (s) => s.ticker !== ticker
      ),
    }));
  },

  clearChart: () => {
    set({ chartSelections: [] });
  },

  setChartPeriod: (period: TimePeriod) => {
    const cutoff = getPeriodCutoff(period);
    set((state) => ({
      chartPeriod: period,
      chartSelections: state.chartSelections.map((s) => ({
        ...s,
        data: cutoff
          ? s.fullData.filter((d) => d.time >= cutoff)
          : s.fullData,
      })),
    }));
  },

  setNormalizeChart: (normalize: boolean) => {
    set({ normalizeChart: normalize });
  },

  setNormalizeDate: (date: string) => {
    set({ normalizeDate: date });
  },

  setMarketSearchText: (text: string) => {
    set({ searchText: text });
  },

  setEntidadFilter: (entidad: string | undefined) => {
    set({ entidadFilter: entidad });
  },

  setActivoFilter: (activo: boolean) => {
    set({ activoFilter: activo });
  },

  setTipoFondoFilter: (tipoFondo: string | undefined) => {
    set({ tipoFondoFilter: tipoFondo });
  },

  setClaseActivoFilter: (clase: string | undefined) => {
    set({ claseActivoFilter: clase });
  },

  setTamanoFondoFilter: (tamano: string | undefined) => {
    set({ tamanoFondoFilter: tamano });
  },

  setTamanoInversionistasFilter: (tamano: string | undefined) => {
    set({ tamanoInversionistasFilter: tamano });
  },

  resetWatchlistOnly: () =>
    set({
      watchlistEntries: [],
      watchlistGroups: [],
      watchlistLoading: false,
      valuesLoading: false,
      searchText: '',
      entidadFilter: undefined,
      tipoFondoFilter: undefined,
      claseActivoFilter: undefined,
      tamanoFondoFilter: undefined,
      tamanoInversionistasFilter: undefined,
    }),

  resetMarketDashboard: () => set(initialMarketState),
});

export default createMarketDashboardSlice;
