import { StateCreator } from 'zustand';
import { buildCurves, getCurveStatus } from 'src/models/pricing/pricingApi';
import type { CurveStatus, BuildResult } from 'src/types/pricing';

export interface CurveSlice {
  curveStatus: CurveStatus | null;
  curveLoading: boolean;
  curvesReady: boolean;
  checkCurveStatus: () => Promise<void>;
  triggerBuildCurves: () => Promise<BuildResult>;
}

const createCurveSlice: StateCreator<CurveSlice> = (set) => ({
  curveStatus: null,
  curveLoading: false,
  curvesReady: false,

  checkCurveStatus: async () => {
    try {
      const status = await getCurveStatus();
      set({
        curveStatus: status,
        curvesReady: !!(status?.ibr?.built && status?.sofr?.built),
      });
    } catch {
      // silently fail — server may not be reachable yet
    }
  },

  triggerBuildCurves: async () => {
    set({ curveLoading: true });
    try {
      const result = await buildCurves();
      set({
        curveStatus: result.full_status,
        curvesReady: !!(result.full_status?.ibr?.built && result.full_status?.sofr?.built),
      });
      return result;
    } finally {
      set({ curveLoading: false });
    }
  },
});

export default createCurveSlice;
