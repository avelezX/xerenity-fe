import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import createLoansSlice, { LoansSlice } from './loans';
import createDashboardSlice, { DashboardSlice } from './dashboard';
import createSeriesSlice, { SeriesSlice } from './series';
import createMarketDashboardSlice, {
  MarketDashboardSlice,
} from './marketDashboard';
import createTradingSlice, { TradingSlice } from './trading';

const useAppStore = create<
  LoansSlice & DashboardSlice & SeriesSlice & MarketDashboardSlice & TradingSlice
>()(
  devtools((...args) => ({
    ...createLoansSlice(...args),
    ...createDashboardSlice(...args),
    ...createSeriesSlice(...args),
    ...createMarketDashboardSlice(...args),
    ...createTradingSlice(...args),
  }))
);

export default useAppStore;
