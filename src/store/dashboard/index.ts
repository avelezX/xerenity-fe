import { StateCreator } from 'zustand';
import { LightSerieEntry } from '@models/lightserie';

export interface DashboardSlice {
  series: LightSerieEntry[];
}

const createDashboardSlice: StateCreator<DashboardSlice> = (set) => ({
  series: [],
});

export default createDashboardSlice;
