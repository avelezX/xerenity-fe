import { StateCreator } from 'zustand';
import { Bank, Loan, LoanCashFlowIbr } from 'src/types/loans';
import {
  calculateCashFlow,
  deleteLoan,
  fetchSupaBanks,
  fetchSupaLoans,
} from 'src/models/loans';
import { LightSerieValue } from 'src/types/lightserie';

type CashFlowItem = {
  loanId: string;
  flows: LoanCashFlowIbr[];
};

export interface LoansSlice {
  banks: Bank[];
  cashFlows: CashFlowItem[];
  chartData: LightSerieValue[];
  mergedCashFlows: LoanCashFlowIbr[];
  loans: Loan[];
  loading: boolean;
  selectedLoans: string[];
  showDeleteConfirm: boolean;
  showLoanModal: boolean;
  showNewCreditModal: boolean;
  selectedBanks: Bank[];
  getLoanData: (bankFilter?: Bank[]) => void;
  setSelectedLoans: (loan: Loan, type: string) => void;
  setSelectedBanks: (banks: Bank[]) => void;
  setCashFlowItem: (loanId: string, type: string) => void;
  onShowDeleteConfirm: (show: boolean) => void;
  onShowLoanModal: (show: boolean) => void;
  onShowNewLoanModal: (show: boolean) => void;
  deleteLoanItem: (loanId: string) => void;
  setMergedCashFlows: (cashFlows: CashFlowItem[]) => void;
  getLoanChartData: (mergedCashFlows: LoanCashFlowIbr[]) => void;
}

const createLoansSlice: StateCreator<LoansSlice> = (set) => ({
  banks: [],
  cashFlows: [],
  chartData: [],
  mergedCashFlows: [],
  loans: [],
  loading: false,
  selectedLoans: [],
  showDeleteConfirm: false,
  showLoanModal: false,
  showNewCreditModal: false,
  selectedBanks: [],
  getLoanData: async (bankFilter: Bank[] = []) => {
    set({ loading: true });
    const response = await fetchSupaBanks();

    if (response.error) {
      set({ loading: false });
      // TODO: Replace by notification to the user
      console.error(response.error);
    } else if (response.data) {
      const banks = bankFilter.length > 0 ? bankFilter : response.data;
      const loanResponse = await fetchSupaLoans(banks);
      set({ banks });

      if (loanResponse.error) {
        set({ loading: false });
        // TODO: Replace by notification to the user
        console.error(response.error);
      } else {
        const loans = loanResponse.data;
        set({ loading: false });
        set({ loans });
      }
    }
  },
  setSelectedLoans: (loan, type) =>
    set((state) => {
      let currentSelections = state.selectedLoans;
      const alreadySelected = currentSelections.find((id) => id === loan.id);

      if (alreadySelected) {
        // Filter out item
        let currentCashflow = state.cashFlows;
        currentSelections = currentSelections.filter((id) => id !== loan.id);
        currentCashflow = currentCashflow.filter(
          ({ loanId }) => loanId !== loan.id
        );
        state.setMergedCashFlows(currentCashflow);
      } else {
        state.setCashFlowItem(loan.id, type);
        currentSelections.push(loan.id);
      }

      return { selectedLoans: currentSelections };
    }),
  setSelectedBanks: (selections: Bank[]) =>
    set((state) => {
      state.getLoanData(selections);
      return { selectedBanks: selections };
    }),
  setCashFlowItem: async (loanId, type) => {
    set({ loading: true });

    const response = await calculateCashFlow(loanId, type);

    if (response.error) {
      set({ loading: false });
      // TODO: Replace by notification to the user
      console.error(response.error);
      // TODO: Deselect item if error happened
    } else if (response.data) {
      set({ loading: false });
      set((state) => {
        const flows = response.data;
        const currentCashflow = state.cashFlows;
        currentCashflow.push({ loanId, flows });
        state.setMergedCashFlows(currentCashflow);
        return { cashFlows: currentCashflow };
      });
    }
  },
  onShowDeleteConfirm: (show: boolean) =>
    set(() => ({ showDeleteConfirm: show })),
  onShowLoanModal: (show: boolean) => set(() => ({ showLoanModal: show })),
  onShowNewLoanModal: (show: boolean) =>
    set(() => ({ showNewCreditModal: show })),
  deleteLoanItem: async (loanId) => {
    set({ loading: true });
    const response = await deleteLoan(loanId);
    if (response.error) {
      set({ loading: false });
      // TODO: Replace by notification to the user
      console.error(response.error);
    } else {
      set({ loading: false });
      set((state) => {
        // TODO: Add by notification to the user
        const currentLoans = state.loans;
        state.onShowDeleteConfirm(false);
        // Filter out deleted item
        return { loans: currentLoans.filter(({ id }) => id !== loanId) };
      });
    }
  },
  setMergedCashFlows: (cashFlows: CashFlowItem[]) =>
    set((state) => {
      const newCashFlow = {};
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
              interest: existing.interest + flow.interest, // Corrected interest calculation
              ending_balance: existing.ending_balance + flow.ending_balance,
              rate_tot: existing.rate_tot,
            };
            newCashFlow[newEntry.date] = newEntry; // Update the entry in newCashFlow
          } else {
            newCashFlow[flow.date] = flow; // Add a new entry to newCashFlow
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
  // TODO: This can be called by an action from the user
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
});

export default createLoansSlice;
