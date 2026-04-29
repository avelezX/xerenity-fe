import { StateCreator } from 'zustand';
import type {
  CollectorFullDetail,
  DataSource,
  DataTableMeta,
  DataConsumer,
  ReviewStatus,
} from 'src/types/catalog';
import {
  getCollectorFullDetail,
  listDataSources,
  listDataTables,
  listDataConsumers,
  listDistinctClassification,
  updateCollectorMetadata,
  updateCollectorTableReview,
  ActionResponse,
} from 'src/models/catalog';

export interface CatalogSlice {
  // Per-collector full detail (cached by collector name)
  catalogDetail: Record<string, CollectorFullDetail>;
  catalogDetailLoading: Record<string, boolean>;
  catalogDetailError: string | undefined;

  // Global registries (used for the autocomplete + future catalog tab)
  catalogSources: DataSource[];
  catalogTables: DataTableMeta[];
  catalogConsumers: DataConsumer[];

  // Distinct classification values keyed by `${entity}:${field}` for autocomplete
  catalogDistinctValues: Record<string, string[]>;

  loadCollectorDetail: (collectorName: string) => Promise<void>;
  loadCatalogRegistries: () => Promise<void>;
  loadDistinctValues: (
    entity: 'data_sources' | 'data_tables_meta',
    field: 'country' | 'category' | 'source_type' | 'consumer_type',
  ) => Promise<void>;

  saveCollectorMetadata: (
    name: string,
    sourceName: string | null,
    notes: string | null,
  ) => Promise<ActionResponse>;

  saveCollectorTableReview: (
    collectorName: string,
    tableName: string,
    status: ReviewStatus,
    notes: string | null,
  ) => Promise<ActionResponse>;
}

const initialState = {
  catalogDetail: {} as Record<string, CollectorFullDetail>,
  catalogDetailLoading: {} as Record<string, boolean>,
  catalogDetailError: undefined as string | undefined,
  catalogSources: [] as DataSource[],
  catalogTables: [] as DataTableMeta[],
  catalogConsumers: [] as DataConsumer[],
  catalogDistinctValues: {} as Record<string, string[]>,
};

const createCatalogSlice: StateCreator<CatalogSlice> = (set, get) => ({
  ...initialState,

  loadCollectorDetail: async (collectorName) => {
    set((s) => ({
      catalogDetailLoading: { ...s.catalogDetailLoading, [collectorName]: true },
      catalogDetailError: undefined,
    }));
    const res = await getCollectorFullDetail(collectorName);
    if (res.error || !res.data) {
      set((s) => ({
        catalogDetailLoading: { ...s.catalogDetailLoading, [collectorName]: false },
        catalogDetailError: res.error,
      }));
      return;
    }
    set((s) => ({
      catalogDetail: { ...s.catalogDetail, [collectorName]: res.data! },
      catalogDetailLoading: { ...s.catalogDetailLoading, [collectorName]: false },
    }));
  },

  loadCatalogRegistries: async () => {
    const [sourcesRes, tablesRes, consumersRes] = await Promise.all([
      listDataSources(),
      listDataTables(),
      listDataConsumers(),
    ]);
    set({
      catalogSources: sourcesRes.data ?? [],
      catalogTables: tablesRes.data ?? [],
      catalogConsumers: consumersRes.data ?? [],
    });
  },

  loadDistinctValues: async (entity, field) => {
    const key = `${entity}:${field}`;
    const res = await listDistinctClassification(entity, field);
    if (res.data) {
      set((s) => ({
        catalogDistinctValues: { ...s.catalogDistinctValues, [key]: res.data! },
      }));
    }
  },

  saveCollectorMetadata: async (name, sourceName, notes) => {
    const res = await updateCollectorMetadata(name, sourceName, notes);
    if (res.ok) {
      // Refresh detail
      await get().loadCollectorDetail(name);
    }
    return res;
  },

  saveCollectorTableReview: async (collectorName, tableName, status, notes) => {
    const res = await updateCollectorTableReview(collectorName, tableName, status, notes);
    if (res.ok) {
      await get().loadCollectorDetail(collectorName);
    }
    return res;
  },
});

export default createCatalogSlice;
