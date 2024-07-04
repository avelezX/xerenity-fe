import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import createLoansSlice, { LoansSlice } from './loans';

const useAppStore = create<LoansSlice>()(
  devtools((...args) => ({
    ...createLoansSlice(...args),
  }))
);

export default useAppStore;
