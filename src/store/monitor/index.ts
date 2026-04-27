import { StateCreator } from 'zustand';
import {
  CollectorOverview,
  CollectorRun,
  CollectorAlert,
} from 'src/types/monitor';
import {
  listCollectorOverview,
  listActiveAlerts,
  listCollectorRuns,
  acknowledgeAlert as ackRpc,
  silenceAlert as silenceRpc,
  resolveAlert as resolveRpc,
  ActionResponse,
} from 'src/models/monitor';

export interface MonitorSlice {
  collectorOverview: CollectorOverview[];
  activeAlerts: CollectorAlert[];
  collectorRuns: Record<string, CollectorRun[]>;
  monitorLoading: boolean;
  monitorError: string | undefined;

  loadCollectorOverview: () => Promise<void>;
  loadActiveAlerts: () => Promise<void>;
  loadCollectorRuns: (collectorName: string, limit?: number) => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<ActionResponse>;
  silenceAlert: (alertId: string, duration: string) => Promise<ActionResponse>;
  resolveAlert: (alertId: string) => Promise<ActionResponse>;
  resetMonitorStore: () => void;
}

const initialState = {
  collectorOverview: [] as CollectorOverview[],
  activeAlerts: [] as CollectorAlert[],
  collectorRuns: {} as Record<string, CollectorRun[]>,
  monitorLoading: false,
  monitorError: undefined as string | undefined,
};

const createMonitorSlice: StateCreator<MonitorSlice> = (set, get) => ({
  ...initialState,

  loadCollectorOverview: async () => {
    set({ monitorLoading: true, monitorError: undefined });
    const res = await listCollectorOverview();
    if (res.error) {
      set({ monitorLoading: false, monitorError: res.error });
      return;
    }
    set({ collectorOverview: res.data, monitorLoading: false });
  },

  loadActiveAlerts: async () => {
    set({ monitorLoading: true, monitorError: undefined });
    const res = await listActiveAlerts();
    if (res.error) {
      set({ monitorLoading: false, monitorError: res.error });
      return;
    }
    set({ activeAlerts: res.data, monitorLoading: false });
  },

  loadCollectorRuns: async (collectorName: string, limit = 30) => {
    set({ monitorLoading: true, monitorError: undefined });
    const res = await listCollectorRuns(collectorName, limit);
    if (res.error) {
      set({ monitorLoading: false, monitorError: res.error });
      return;
    }
    set((state) => ({
      collectorRuns: { ...state.collectorRuns, [collectorName]: res.data },
      monitorLoading: false,
    }));
  },

  acknowledgeAlert: async (alertId: string) => {
    const res = await ackRpc(alertId);
    if (res.success) await get().loadActiveAlerts();
    return res;
  },

  silenceAlert: async (alertId: string, duration: string) => {
    const res = await silenceRpc(alertId, duration);
    if (res.success) await get().loadActiveAlerts();
    return res;
  },

  resolveAlert: async (alertId: string) => {
    const res = await resolveRpc(alertId);
    if (res.success) {
      await Promise.all([get().loadActiveAlerts(), get().loadCollectorOverview()]);
    }
    return res;
  },

  resetMonitorStore: () => set(initialState),
});

export default createMonitorSlice;
