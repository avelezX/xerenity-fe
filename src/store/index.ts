import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import createLoansSlice, { LoansSlice } from './loans';
import createDashboardSlice, { DashboardSlice } from './dashboard';
import createSeriesSlice, { SeriesSlice } from './series';
import createMarketDashboardSlice, {
  MarketDashboardSlice,
} from './marketDashboard';

const useAppStore = create<
  LoansSlice & DashboardSlice & SeriesSlice & MarketDashboardSlice
>()(
  devtools((...args) => ({
    ...createLoansSlice(...args),
    ...createDashboardSlice(...args),
    ...createSeriesSlice(...args),
    ...createMarketDashboardSlice(...args),
  }))
);

export default useAppStore;
