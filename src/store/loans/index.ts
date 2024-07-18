import { StateCreator } from 'zustand';
import { Bank, Loan, LoanCashFlowIbr, CashFlowItem } from 'src/types/loans';
import {
  fetchCashFlows,
  deleteLoan,
  fetchBanks,
  fetchLoans,
  LoanResponse,
  BankResponse,
  CashflowResponse,
  DeleteLoanResponse,
} from 'src/models/loans';
import { LightSerieValue } from 'src/types/lightserie';
import { SelectableRows } from 'src/types/selectableRows';

export interface LoansSlice {
  banks: Bank[];
  cashFlows: CashFlowItem[];
  chartData: LightSerieValue[];
  errorMessage: string | undefined;
  successMessage: string | undefined;
  mergedCashFlows: LoanCashFlowIbr[];
  loans: Loan[];
  loading: boolean;
  selectedLoans: string[];
  showDeleteConfirm: boolean;
  showLoanModal: boolean;
  showNewCreditModal: boolean;
  selectedBanks: Bank[];
  showCashFlowTable: boolean;
  getLoanData: (bankFilter?: Bank[]) => void;
  setSelectedLoans: ({
    selectedCount,
    selectedRows,
  }: SelectableRows<Loan>) => void;
  setSelectedBanks: (banks: Bank[]) => void;
  setCashFlowItem: (
    loanId: string,
    type: string,
    currentOther: CashFlowItem[]
  ) => void;
  onShowDeleteConfirm: (show: boolean) => void;
  onShowLoanModal: (show: boolean) => void;
  onShowNewLoanModal: (show: boolean) => void;
  onShowCashFlowTable: (show: boolean) => void;
  deleteLoanItem: (loanId: string) => void;
  setMergedCashFlows: (cashFlows: CashFlowItem[]) => void;
  getLoanChartData: (mergedCashFlows: LoanCashFlowIbr[]) => void;
  resetStore: () => void;
}

const initialState = {
  banks: [],
  cashFlows: [],
  chartData: [],
  errorMessage: undefined,
  successMessage: undefined,
  mergedCashFlows: [],
  loans: [],
  loading: false,
  selectedLoans: [],
  showCashFlowTable: false,
  showDeleteConfirm: false,
  showLoanModal: false,
  showNewCreditModal: false,
  selectedBanks: [],
};

const createLoansSlice: StateCreator<LoansSlice> = (set) => ({
  ...initialState,
  // Store Actions
  getLoanData: async (bankFilter: Bank[] = []) => {
    // Set initial state before fetching data
    set({ loading: true, errorMessage: undefined, successMessage: undefined });
    const response: BankResponse = await fetchBanks();

    if (response.error) {
      set({ loading: false });
      set({ errorMessage: response.error });
    } else if (response.data) {
      const banks: Bank[] = bankFilter.length > 0 ? bankFilter : response.data;
      const loanResponse: LoanResponse = await fetchLoans(banks);
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
  setSelectedLoans: ({ selectedRows }: SelectableRows<Loan>) =>
    set((state) => {
      const newSelections: string[] = [];
      const currentCashflow = state.cashFlows;
      const newCashFlow: CashFlowItem[] = [];

      selectedRows.forEach((loan: Loan) => {
        const flow = currentCashflow.find((f) => f.loanId === loan.id);

        if (flow) {
          newCashFlow.push(flow);
        } else {
          state.setCashFlowItem(loan.id, loan.type, newCashFlow);
        }
        newSelections.push(loan.id);
      });

      state.setMergedCashFlows(newCashFlow);
      return { selectedLoans: newSelections };
    }),
  setSelectedBanks: (selections: Bank[]) =>
    set((state) => {
      state.getLoanData(selections);
      return { selectedBanks: selections };
    }),
  setCashFlowItem: async (loanId, type, currentOther) => {
    set({ loading: true, errorMessage: undefined, successMessage: undefined });
    const response: CashflowResponse = await fetchCashFlows(loanId, type);

    if (response.error) {
      set((state) => {
        // Deselect item if error happened
        const currentSelections = state.selectedLoans;
        return {
          loading: false,
          selectedLoans: currentSelections.filter((id) => id !== loanId),
          errorMessage: response.error,
          successMessage: undefined,
        };
      });
    } else if (response.data) {
      set((state) => {
        const flows = response.data || [];
        currentOther.push({ loanId, flows });
        state.setMergedCashFlows(currentOther);
        return { loading: false, cashFlows: currentOther };
      });
    }
  },
  onShowDeleteConfirm: (show: boolean) =>
    set(() => ({ showDeleteConfirm: show })),
  onShowCashFlowTable: (show: boolean) =>
    set(() => ({ showCashFlowTable: show })),
  onShowLoanModal: (show: boolean) => set(() => ({ showLoanModal: show })),
  onShowNewLoanModal: (show: boolean) =>
    set(() => ({ showNewCreditModal: show })),
  deleteLoanItem: async (loanId) => {
    set({ loading: true, errorMessage: undefined, successMessage: undefined });
    const response: DeleteLoanResponse = await deleteLoan(loanId);

    if (response.error) {
      set({ loading: false });
      set({ errorMessage: response.error });
    } else if (response.data) {
      set({ loading: false });
      set((state) => {
        const currentLoans = state.loans;
        state.onShowDeleteConfirm(false);
        // Filter out deleted item and notify of success
        return {
          loans: currentLoans.filter(({ id }) => id !== loanId),
          successMessage: response.data?.message,
        };
      });
    }
  },
  setMergedCashFlows: (cashFlows: CashFlowItem[]) =>
    set((state) => {
      const newCashFlow: { [date: string]: LoanCashFlowIbr } = {};

      cashFlows.forEach((item) => {
        item.flows.forEach((flow) => {
          const existing = newCashFlow[flow.date];
          if (existing) {
            const newEntry = {
              principal: existing.principal + flow.principal,
              rate: existing.rate,
              date: flow.date,
              beginning_balance:
                existing.beginning_balance + flow.beginning_balance,
              payment: existing.payment + flow.payment,
              // Corrected interest calculation
              interest: existing.interest + flow.interest,
              ending_balance: existing.ending_balance + flow.ending_balance,
              rate_tot: existing.rate_tot,
            };
            // Update the entry in newCashFlow
            newCashFlow[newEntry.date] = newEntry;
          } else {
            // Add a new entry to newCashFlow
            newCashFlow[flow.date] = flow;
          }
        });
      });

      const mergedCashFlows: LoanCashFlowIbr[] = Object.values(newCashFlow).map(
        (val) => val
      );

      mergedCashFlows.sort((a, b) => (a.date < b.date ? -1 : 1));
      state.getLoanChartData(mergedCashFlows);

      return { mergedCashFlows };
    }),
  getLoanChartData: (mergedCashFlows: LoanCashFlowIbr[]) => {
    const chartData: LightSerieValue[] = [];
    mergedCashFlows.forEach((value) => {
      chartData.push({
        time: value.date.split(' ')[0],
        value: value.payment,
      });
    });

    set({ chartData });
  },
  resetStore: () => set(initialState),
});

export default createLoansSlice;
