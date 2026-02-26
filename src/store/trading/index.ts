import { StateCreator } from 'zustand';
import {
  XccyPosition,
  NdfPosition,
  IbrSwapPosition,
  PricedXccy,
  PricedNdf,
  PricedIbrSwap,
  PortfolioSummary,
  NewXccyPosition,
  NewNdfPosition,
  NewIbrSwapPosition,
} from 'src/types/trading';
import {
  fetchXccyPositions,
  fetchNdfPositions,
  fetchIbrSwapPositions,
  createXccyPosition,
  createNdfPosition,
  createIbrSwapPosition,
  deleteXccyPositions,
  deleteNdfPositions,
  deleteIbrSwapPositions,
  repricePortfolio,
} from 'src/models/trading';

export interface TradingSlice {
  // Raw positions from DB
  xccyPositions: XccyPosition[];
  ndfPositions: NdfPosition[];
  ibrSwapPositions: IbrSwapPosition[];

  // Priced results
  pricedXccy: PricedXccy[];
  pricedNdf: PricedNdf[];
  pricedIbrSwap: PricedIbrSwap[];
  summary: PortfolioSummary | null;

  // UI state
  tradingLoading: boolean;
  tradingError: string | undefined;
  tradingSuccess: string | undefined;
  pricedAt: string | undefined;

  // Actions
  loadPositions: () => Promise<void>;
  repriceAll: () => Promise<void>;
  addXccyPosition: (values: NewXccyPosition) => Promise<void>;
  addNdfPosition: (values: NewNdfPosition) => Promise<void>;
  addIbrSwapPosition: (values: NewIbrSwapPosition) => Promise<void>;
  removeXccyPositions: (ids: string[]) => Promise<void>;
  removeNdfPositions: (ids: string[]) => Promise<void>;
  removeIbrSwapPositions: (ids: string[]) => Promise<void>;
  resetTradingStore: () => void;
}

const initialTradingState = {
  xccyPositions: [],
  ndfPositions: [],
  ibrSwapPositions: [],
  pricedXccy: [],
  pricedNdf: [],
  pricedIbrSwap: [],
  summary: null,
  tradingLoading: false,
  tradingError: undefined,
  tradingSuccess: undefined,
  pricedAt: undefined,
};

const createTradingSlice: StateCreator<TradingSlice> = (set, get) => ({
  ...initialTradingState,

  loadPositions: async () => {
    set({ tradingLoading: true, tradingError: undefined });
    try {
      const [xccy, ndf, ibrSwap] = await Promise.all([
        fetchXccyPositions(),
        fetchNdfPositions(),
        fetchIbrSwapPositions(),
      ]);

      const error = xccy.error || ndf.error || ibrSwap.error;
      if (error) {
        set({ tradingLoading: false, tradingError: error });
        return;
      }

      set({
        xccyPositions: xccy.data,
        ndfPositions: ndf.data,
        ibrSwapPositions: ibrSwap.data,
        tradingLoading: false,
      });
    } catch {
      set({ tradingLoading: false, tradingError: 'Error loading positions' });
    }
  },

  repriceAll: async () => {
    const { xccyPositions, ndfPositions, ibrSwapPositions } = get();
    const total =
      xccyPositions.length + ndfPositions.length + ibrSwapPositions.length;
    if (total === 0) return;

    set({ tradingLoading: true, tradingError: undefined });
    try {
      const result = await repricePortfolio(
        xccyPositions,
        ndfPositions,
        ibrSwapPositions
      );
      set({
        pricedXccy: result.xccy_results,
        pricedNdf: result.ndf_results,
        pricedIbrSwap: result.ibr_swap_results,
        summary: result.summary,
        tradingLoading: false,
        pricedAt: new Date().toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      });
    } catch (e) {
      set({
        tradingLoading: false,
        tradingError: e instanceof Error ? e.message : 'Reprice failed',
      });
    }
  },

  addXccyPosition: async (values: NewXccyPosition) => {
    set({ tradingLoading: true, tradingError: undefined, tradingSuccess: undefined });
    const res = await createXccyPosition(values);
    if (res.error) {
      set({ tradingLoading: false, tradingError: res.error });
    } else {
      set({ tradingLoading: false, tradingSuccess: res.data?.message });
      await get().loadPositions();
    }
  },

  addNdfPosition: async (values: NewNdfPosition) => {
    set({ tradingLoading: true, tradingError: undefined, tradingSuccess: undefined });
    const res = await createNdfPosition(values);
    if (res.error) {
      set({ tradingLoading: false, tradingError: res.error });
    } else {
      set({ tradingLoading: false, tradingSuccess: res.data?.message });
      await get().loadPositions();
    }
  },

  addIbrSwapPosition: async (values: NewIbrSwapPosition) => {
    set({ tradingLoading: true, tradingError: undefined, tradingSuccess: undefined });
    const res = await createIbrSwapPosition(values);
    if (res.error) {
      set({ tradingLoading: false, tradingError: res.error });
    } else {
      set({ tradingLoading: false, tradingSuccess: res.data?.message });
      await get().loadPositions();
    }
  },

  removeXccyPositions: async (ids: string[]) => {
    set({ tradingLoading: true, tradingError: undefined });
    const res = await deleteXccyPositions(ids);
    if (res.error) {
      set({ tradingLoading: false, tradingError: res.error });
    } else {
      set((state) => ({
        tradingLoading: false,
        xccyPositions: state.xccyPositions.filter((p) => !ids.includes(p.id)),
        pricedXccy: state.pricedXccy.filter((p) => !ids.includes(p.id)),
        tradingSuccess: res.data?.message,
      }));
    }
  },

  removeNdfPositions: async (ids: string[]) => {
    set({ tradingLoading: true, tradingError: undefined });
    const res = await deleteNdfPositions(ids);
    if (res.error) {
      set({ tradingLoading: false, tradingError: res.error });
    } else {
      set((state) => ({
        tradingLoading: false,
        ndfPositions: state.ndfPositions.filter((p) => !ids.includes(p.id)),
        pricedNdf: state.pricedNdf.filter((p) => !ids.includes(p.id)),
        tradingSuccess: res.data?.message,
      }));
    }
  },

  removeIbrSwapPositions: async (ids: string[]) => {
    set({ tradingLoading: true, tradingError: undefined });
    const res = await deleteIbrSwapPositions(ids);
    if (res.error) {
      set({ tradingLoading: false, tradingError: res.error });
    } else {
      set((state) => ({
        tradingLoading: false,
        ibrSwapPositions: state.ibrSwapPositions.filter(
          (p) => !ids.includes(p.id)
        ),
        pricedIbrSwap: state.pricedIbrSwap.filter(
          (p) => !ids.includes(p.id)
        ),
        tradingSuccess: res.data?.message,
      }));
    }
  },

  resetTradingStore: () => set(initialTradingState),
});

export default createTradingSlice;
