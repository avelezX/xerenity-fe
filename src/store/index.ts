import { create } from 'zustand';
import createDashboardSlice, { DashboardSlice } from './dashboard';

const useAppStore = create<DashboardSlice>((...a) => ({
  ...createDashboardSlice(...a),
}));

export default useAppStore;
