import { StateCreator } from 'zustand';
import { LightSerieEntry } from 'src/types/lightserie';

export interface DashboardSlice {
  series: LightSerieEntry[];
  selectedSeries: LightSerieEntry[];
}

const createDashboardSlice: StateCreator<DashboardSlice> = (set) => ({
  series: [],
  selectedSeries: [],
});

export default createDashboardSlice;
