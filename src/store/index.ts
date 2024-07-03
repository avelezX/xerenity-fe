import { create } from 'zustand';
import createLoansSlice, { LoansSlice } from './loans';

const useAppStore = create<LoansSlice>((...a) => ({
  ...createLoansSlice(...a),
}));

export default useAppStore;
