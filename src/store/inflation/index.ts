import { StateCreator } from 'zustand';
import {
  CPIPoint,
  CPISnapshot,
  CPIContribution,
  InflationCanasta,
} from 'src/types/inflation';
import {
  fetchCanastas,
  fetchCanastaTree,
  fetchCPIFullSeries,
  fetchCPISnapshot,
  fetchCPIContributions,
} from 'src/models/inflation';

const TOTAL_ID = 1;
const DEFAULT_CONTRIB_MONTHS = 24;

export interface InflationSlice {
  canastas: InflationCanasta[];
  selectedCanastaIds: number[];
  seriesByCanasta: Record<number, CPIPoint[]>;
  snapshotByCanasta: Record<number, CPISnapshot>;
  contributions: CPIContribution[];
  contribMonthsBack: number;
  inflationLoading: boolean;
  inflationError: string | undefined;

  loadInflationCatalog: () => Promise<void>;
  loadCanastaSeries: (id: number) => Promise<void>;
  loadCanastaSnapshot: (id: number) => Promise<void>;
  loadContributions: (monthsBack?: number) => Promise<void>;
  toggleCanasta: (id: number) => Promise<void>;
  setSelectedCanastaIds: (ids: number[]) => Promise<void>;
}

const initialState = {
  canastas: [] as InflationCanasta[],
  selectedCanastaIds: [TOTAL_ID],
  seriesByCanasta: {} as Record<number, CPIPoint[]>,
  snapshotByCanasta: {} as Record<number, CPISnapshot>,
  contributions: [] as CPIContribution[],
  contribMonthsBack: DEFAULT_CONTRIB_MONTHS,
  inflationLoading: false,
  inflationError: undefined as string | undefined,
};

const createInflationSlice: StateCreator<InflationSlice> = (set, get) => ({
  ...initialState,

  loadInflationCatalog: async () => {
    set({ inflationLoading: true, inflationError: undefined });
    // Use cpi_canasta_tree so we get the hierarchy (nivel + id_padre) and
    // the SmallMultiples / decomposition components can filter divisions
    // from subgroups cleanly.
    const res = await fetchCanastaTree();
    if (res.error || !res.data) {
      // Fallback to the flat catalog if the RPC ever fails.
      const fallback = await fetchCanastas();
      if (fallback.error || !fallback.data) {
        set({ inflationLoading: false, inflationError: res.error });
        return;
      }
      const total: InflationCanasta = { id: TOTAL_ID, nombre: 'Total Nacional', peso: 1, nivel: 0 };
      set({ canastas: [total, ...fallback.data.filter((c) => c.id !== TOTAL_ID)], inflationLoading: false });
      return;
    }
    const hasTotal = res.data.some((c) => c.id === TOTAL_ID);
    const total: InflationCanasta = { id: TOTAL_ID, nombre: 'Total Nacional', peso: 1, nivel: 0 };
    const merged = hasTotal ? res.data : [total, ...res.data];
    set({ canastas: merged, inflationLoading: false });
  },

  loadCanastaSeries: async (id: number) => {
    if (get().seriesByCanasta[id]) return;
    const res = await fetchCPIFullSeries(id);
    if (res.error || !res.data) {
      set({ inflationError: res.error });
      return;
    }
    set((state) => ({
      seriesByCanasta: { ...state.seriesByCanasta, [id]: res.data as CPIPoint[] },
    }));
  },

  loadCanastaSnapshot: async (id: number) => {
    if (get().snapshotByCanasta[id]) return;
    const res = await fetchCPISnapshot(id);
    if (res.error || !res.data) {
      set({ inflationError: res.error });
      return;
    }
    set((state) => ({
      snapshotByCanasta: { ...state.snapshotByCanasta, [id]: res.data as CPISnapshot },
    }));
  },

  loadContributions: async (monthsBack?: number) => {
    const months = monthsBack ?? get().contribMonthsBack;
    const res = await fetchCPIContributions(months);
    if (res.error || !res.data) {
      set({ inflationError: res.error });
      return;
    }
    set({ contributions: res.data, contribMonthsBack: months });
  },

  toggleCanasta: async (id: number) => {
    const current = get().selectedCanastaIds;
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    await get().setSelectedCanastaIds(next);
  },

  setSelectedCanastaIds: async (ids: number[]) => {
    set({ selectedCanastaIds: ids });
    await Promise.all(
      ids.map(async (id) => {
        await get().loadCanastaSeries(id);
        await get().loadCanastaSnapshot(id);
      })
    );
  },
});

export default createInflationSlice;
