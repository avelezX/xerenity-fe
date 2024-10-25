import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import createLoansSlice, { LoansSlice } from './loans';
import createDashboardSlice, { DashboardSlice } from './dashboard';
import createSeriesSlice, { SeriesSlice } from './series';

const useAppStore = create<LoansSlice & DashboardSlice & SeriesSlice>()(
  devtools((...args) => ({
    ...createLoansSlice(...args),
    ...createDashboardSlice(...args),
    ...createSeriesSlice(...args),
  }))
);

export default useAppStore;
