/**
 * Loans store — write side only after #316.
 *
 * What lives here:
 * - Lookup data: `banks`, `loans`.
 * - UI flags: modal show/hide, current selection, filter date.
 * - Mutations: createLoan, deleteLoanItem, deleteMultipleLoans, getLoanData,
 *   setSelectedBanks, setFilterDate, setCurrentSelection, wakeServer.
 *
 * What moved out:
 * - Per-loan cashflows + aggregation (cashFlows, mergedCashFlows, fullLoan,
 *   loanDebtData, chartData, calculationProgress) — now `useLoanPortfolioSummary`
 *   in `src/queries/loans.ts`.
 * - The big `setSelectedLoans` action (batches of 5, tokens, AbortController,
 *   retry) — TanStack Query handles all of it via `useQueries`.
 * - `buildPortfolioSummary` helper — kept identical, just moved to the queries
 *   file as a pure helper.
 *
 * The page tracks its own `selectedIds: Set<string>` in local state and feeds
 * it to the hook. There is no longer a "selectedLoans" mirror in the store.
 */
import { StateCreator } from 'zustand';
import { Bank, Loan, NewLoanValues } from 'src/types/loans';
import {
  createNewLoan,
  deleteLoan,
  fetchBanks,
  fetchLoans,
  LoanResponse,
  BankResponse,
  DeleteLoanResponse,
  CreateLoanResponse,
  wakeUpServer,
} from 'src/models/loans';
import calculateCurrentDate from 'src/utils/calculateCurrentDate';

export interface LoansSlice {
  banks: Bank[];
  currentSelection: Loan | undefined;
  errorMessage: string | undefined;
  successMessage: string | undefined;
  loans: Loan[];
  loading: boolean;
  showDeleteConfirm: boolean;
  showLoanModal: boolean;
  showNewLoanModal: boolean;
  selectedBanks: Bank[];
  showCashFlowTable: boolean;
  showLoanDebtTable: boolean;
  filterDate: string;

  createLoan: (values: NewLoanValues) => void;
  getLoanData: (bankFilter?: Bank[], companyId?: string) => void;
  setSelectedBanks: (banks: Bank[]) => void;
  onShowDeleteConfirm: (show: boolean) => void;
  onShowLoanModal: (show: boolean) => void;
  onShowNewLoanModal: (show: boolean) => void;
  onShowCashFlowTable: (show: boolean) => void;
  onShowLoanDebtTable: (show: boolean) => void;
  deleteLoanItem: (loanId: string) => void;
  setFilterDate: (newFilterDate: string) => void;
  resetStore: () => void;
  setCurrentSelection: (loan: Loan) => void;
  wakeServer: () => void;
  deleteMultipleLoans: (loanIds: string[]) => void;
}

const initialState = {
  banks: [],
  errorMessage: undefined,
  successMessage: undefined,
  loans: [],
  loading: false,
  showCashFlowTable: false,
  showDeleteConfirm: false,
  showLoanModal: false,
  showNewLoanModal: false,
  showLoanDebtTable: false,
  selectedBanks: [],
  filterDate: calculateCurrentDate(),
  currentSelection: undefined,
};

const createLoansSlice: StateCreator<LoansSlice> = (set) => ({
  ...initialState,

  createLoan: async (values: NewLoanValues) => {
    set((state) => {
      state.onShowNewLoanModal(false);
      return {
        loading: true,
        errorMessage: undefined,
        successMessage: undefined,
      };
    });

    const response: CreateLoanResponse = await createNewLoan(values);

    if (response.error) {
      set({ loading: false });
      set({ errorMessage: response.error });
    } else if (response.data) {
      set((state) => {
        state.getLoanData();
        return {
          loading: false,
          successMessage: response.data?.message,
        };
      });
    }
  },

  getLoanData: async (bankFilter: Bank[] = [], companyId?: string) => {
    set({ loading: true, errorMessage: undefined, successMessage: undefined });
    const response: BankResponse = await fetchBanks();

    if (response.error) {
      set({ loading: false });
      set({ errorMessage: response.error });
    } else if (response.data) {
      const banks: Bank[] = bankFilter.length > 0 ? bankFilter : response.data;
      const loanResponse: LoanResponse = await fetchLoans(banks, companyId);
      set({ banks });

      if (loanResponse.error) {
        set({ loading: false });
        set({ errorMessage: response.error });
      } else {
        const loans = loanResponse.data;
        set({ loading: false });
        set({ loans });
      }
    }
  },

  setCurrentSelection: (loan: Loan) => {
    set(() => ({ currentSelection: loan }));
  },

  setSelectedBanks: (selections: Bank[]) =>
    set((state) => {
      state.getLoanData(selections);
      return { selectedBanks: selections };
    }),

  onShowDeleteConfirm: (show: boolean) =>
    set(() => ({ showDeleteConfirm: show })),
  onShowLoanDebtTable: (show: boolean) =>
    set(() => ({ showLoanDebtTable: show })),
  onShowCashFlowTable: (show: boolean) =>
    set(() => ({ showCashFlowTable: show })),
  onShowLoanModal: (show: boolean) => set(() => ({ showLoanModal: show })),
  onShowNewLoanModal: (show: boolean) =>
    set(() => ({ showNewLoanModal: show })),

  deleteLoanItem: async (loanId) => {
    set({ loading: true, errorMessage: undefined, successMessage: undefined });
    const response: DeleteLoanResponse = await deleteLoan([loanId]);
    set({ loading: false });
    if (response.error) {
      set({ errorMessage: response.error });
    } else if (response.data) {
      set((state) => {
        const currentLoans = state.loans;
        state.onShowDeleteConfirm(false);
        return {
          loans: currentLoans.filter(({ id }) => id !== loanId),
          successMessage: response.data?.message,
        };
      });
    }
  },

  setFilterDate: (newFilterDate: string) =>
    set(() => ({ filterDate: newFilterDate })),

  resetStore: () => set(initialState),

  wakeServer: async () => {
    const response = await wakeUpServer();
    return response;
  },

  deleteMultipleLoans: async (loanIds: string[]) => {
    set({ loading: true, errorMessage: undefined, successMessage: undefined });
    const response: DeleteLoanResponse = await deleteLoan(loanIds);

    if (response.error) {
      set({ loading: false });
      set({ errorMessage: response.error });
    } else if (response.data) {
      set({ loading: false });
      set((state) => {
        const currentLoans = state.loans;
        state.onShowDeleteConfirm(false);
        return {
          loans: currentLoans.filter(({ id }) => !loanIds.includes(id)),
          successMessage: response.data?.message,
        };
      });
    }
  },
});

export default createLoansSlice;
