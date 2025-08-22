import { StateCreator } from 'zustand';
import {
  Bank,
  Loan,
  LoanCashFlowIbr,
  CashFlowItem,
  NewLoanValues,
  LoanData,
} from 'src/types/loans';
import {
  createNewLoan,
  fetchCashFlows,
  deleteLoan,
  fetchBanks,
  fetchLoans,
  LoanResponse,
  BankResponse,
  CashflowResponse,
  DeleteLoanResponse,
  CreateLoanResponse,
  fetchLoansIbrs,
  wakeUpServer,
} from 'src/models/loans';
import { LightSerieValue } from 'src/types/lightserie';
import { SelectedLoansDate } from 'src/types/selectableRows';
import calculateCurrentDate from 'src/utils/calculateCurrentDate';
import { FullLoanResponse } from 'src/models/loans/fetchIbrLoans';

export interface LoansSlice {
  banks: Bank[];
  loanDebtData: LoanData[];
  currentSelection: Loan | undefined;
  cashFlows: CashFlowItem[];
  chartData: LightSerieValue[];
  createLoan: (values: NewLoanValues) => void;
  errorMessage: string | undefined;
  successMessage: string | undefined;
  mergedCashFlows: LoanCashFlowIbr[];
  loans: Loan[];
  loading: boolean;
  selectedLoans: string[];
  showDeleteConfirm: boolean;
  showLoanModal: boolean;
  showNewLoanModal: boolean;
  selectedBanks: Bank[];
  showCashFlowTable: boolean;
  showLoanDebtTable: boolean;
  fullLoan: LoanData | undefined;
  filterDate: string;
  getLoanData: (bankFilter?: Bank[]) => void;
  setSelectedLoans: ({
    selectedCount,
    selectedRows,
    filterDate,
  }: SelectedLoansDate<Loan>) => void;
  setSelectedBanks: (banks: Bank[]) => void;
  setCashFlowItem: (
    loanId: string,
    type: string,
    currentOther: CashFlowItem[],
    filterDate: string
  ) => void;
  onShowDeleteConfirm: (show: boolean) => void;
  onShowLoanModal: (show: boolean) => void;
  onShowNewLoanModal: (show: boolean) => void;
  onShowCashFlowTable: (show: boolean) => void;
  onShowLoanDebtTable: (show: boolean) => void;
  deleteLoanItem: (loanId: string) => void;
  setMergedCashFlows: (cashFlows: CashFlowItem[]) => void;
  getLoanChartData: (mergedCashFlows: LoanCashFlowIbr[]) => void;
  setFilterDate: (newFilterDate: string) => void;
  resetStore: () => void;
  setCurrentSelection: (loan: Loan) => void;
  wakeServer: () => void;
  deleteMultipleLoans: (loanIds: string[]) => void;
}

const initialState = {
  banks: [],
  cashFlows: [],
  chartData: [],
  errorMessage: undefined,
  successMessage: undefined,
  fullLoan: undefined,
  mergedCashFlows: [],
  loans: [],
  loanDebtData: [],
  loading: false,
  selectedLoans: [],
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
  // Store Actions
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
  setCurrentSelection: (loan: Loan) => {
    set(() => ({ currentSelection: loan }));
  },
  setSelectedLoans: async ({
    selectedRows,
    filterDate,
  }: SelectedLoansDate<Loan>) => {
    set({ loading: true, errorMessage: undefined, successMessage: undefined });
    const loanIds = selectedRows.map((item) => item.id);
    if (loanIds.length > 0) {
      const response: FullLoanResponse = await fetchLoansIbrs(
        loanIds,
        filterDate
      );
      set({ loading: false });
      if (!response.error) {
        const loanD = response.data as LoanData[];

        const summary = loanD.filter((value) => {
          const numberValue = Number(value.bank);
          return !Number.isNaN(numberValue) && numberValue === 0;
        });

        if (summary.length > 0) {
          set(() => ({ fullLoan: summary[0] }));
        }

        set(() => ({
          loanDebtData: loanD.filter((value) => {
            const numberValue = Number(value.bank);
            return Number.isNaN(numberValue);
          }),
        }));
      }
    }
    set((state) => {
      const newSelections: string[] = [];
      const currentCashflow = state.cashFlows;
      const newCashFlow: CashFlowItem[] = [];

      selectedRows.forEach((loan: Loan) => {
        const flow = currentCashflow.find((f) => f.loanId === loan.id);

        if (flow) {
          newCashFlow.push(flow);
        } else {
          state.setCashFlowItem(
            loan.id,
            loan.type,
            newCashFlow,
            state.filterDate
          );
        }
        newSelections.push(loan.id);
      });

      state.setMergedCashFlows(newCashFlow);

      return { selectedLoans: newSelections, loading: false };
    });
  },
  setSelectedBanks: (selections: Bank[]) =>
    set((state) => {
      state.getLoanData(selections);
      return { selectedBanks: selections };
    }),
  setCashFlowItem: async (loanId, type, currentOther, filterDate) => {
    set({ loading: true, errorMessage: undefined, successMessage: undefined });
    const response: CashflowResponse = await fetchCashFlows(
      loanId,
      type,
      filterDate
    );

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
        // Filter out deleted item and notify of success
        return {
          loans: currentLoans.filter(({ id }) => !loanIds.includes(id)),
          successMessage: response.data?.message,
        };
      });
    }
  },
});

export default createLoansSlice;
