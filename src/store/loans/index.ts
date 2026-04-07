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
  wakeUpServer,
} from 'src/models/loans';
import { LightSerieValue } from 'src/types/lightserie';
import { SelectedLoansDate } from 'src/types/selectableRows';
import calculateCurrentDate from 'src/utils/calculateCurrentDate';

export interface CalculationProgress {
  total: number;
  completed: number;
  calculating: boolean;
}

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
  calculationProgress: CalculationProgress;
  getLoanData: (bankFilter?: Bank[], companyId?: string) => void;
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
  calculationProgress: { total: 0, completed: 0, calculating: false },
};

// ─── Helper: build portfolio summary from individual cashflows ───
function buildPortfolioSummary(
  cashFlows: CashFlowItem[],
  loans: Loan[]
): { fullLoan: LoanData; loanDebtData: LoanData[] } {
  const today = new Date().toISOString().slice(0, 10);
  const periodYears: Record<string, number> = {
    Mensual: 1 / 12, Trimestral: 0.25, Semestral: 0.5, Anual: 1,
  };

  // Per-bank accumulator
  const bankAcc: Record<string, {
    totalValue: number; accrued: number;
    weightedRate: number; weightedTenor: number; weightedDuration: number;
    loanCount: number; loanIds: string[];
    tvFija: number; tvIbr: number; tvUvr: number;
    wrFija: number; wrIbr: number; wrUvr: number;
  }> = {};

  cashFlows.forEach((cf) => {
    if (cf.flows.length === 0) return;
    const loan = loans.find((l) => l.id === cf.loanId);
    if (!loan) return;

    // Current outstanding balance: last ending_balance before today
    const pastFlows = cf.flows.filter((f) => f.date.split(' ')[0] <= today);
    const outstanding = pastFlows.length > 0
      ? pastFlows[pastFlows.length - 1].ending_balance
      : cf.flows[0].beginning_balance;

    if (outstanding <= 0) return;

    // Average rate from cashflows
    const avgRate = cf.flows.reduce((s, f) => s + (f.rate_tot ?? 0), 0) / cf.flows.length;

    // Remaining tenor
    const remainingFlows = cf.flows.filter((f) => f.date.split(' ')[0] > today);
    const pY = periodYears[loan.periodicity] ?? 0.25;
    const remainingTenor = remainingFlows.length * pY;

    // Simple duration approximation (weighted avg time of remaining flows)
    let durationSum = 0;
    remainingFlows.forEach((f, i) => {
      const t = (i + 1) * pY;
      durationSum += t * (f.payment ?? 0);
    });
    const totalPayments = remainingFlows.reduce((s, f) => s + (f.payment ?? 0), 0);
    const duration = totalPayments > 0 ? durationSum / totalPayments : remainingTenor;

    const bank = loan.bank || 'Unknown';
    if (!bankAcc[bank]) {
      bankAcc[bank] = {
        totalValue: 0, accrued: 0,
        weightedRate: 0, weightedTenor: 0, weightedDuration: 0,
        loanCount: 0, loanIds: [],
        tvFija: 0, tvIbr: 0, tvUvr: 0,
        wrFija: 0, wrIbr: 0, wrUvr: 0,
      };
    }

    const b = bankAcc[bank];
    b.totalValue += outstanding;
    b.weightedRate += avgRate * outstanding;
    b.weightedTenor += remainingTenor * outstanding;
    b.weightedDuration += duration * outstanding;
    b.loanCount += 1;
    b.loanIds.push(loan.id);

    if (loan.type === 'fija') {
      b.tvFija += outstanding;
      b.wrFija += avgRate * outstanding;
    } else if (loan.type === 'ibr') {
      b.tvIbr += outstanding;
      b.wrIbr += avgRate * outstanding;
    } else if (loan.type === 'uvr') {
      b.tvUvr += outstanding;
      b.wrUvr += avgRate * outstanding;
    }
  });

  // Build LoanData per bank
  const loanDebtData: LoanData[] = [];
  let gtv = 0; let gac = 0; let gwr = 0; let gwt = 0; let gwd = 0; let glc = 0;
  let gtvF = 0; let gtvI = 0; let gtvU = 0; let gwrF = 0; let gwrI = 0; let gwrU = 0;

  Object.entries(bankAcc).forEach(([bank, b]) => {
    const tv = b.totalValue;
    loanDebtData.push({
      bank,
      loan_ids: b.loanIds,
      loan_count: b.loanCount,
      total_value: tv,
      accrued_interest: b.accrued,
      average_irr: tv > 0 ? b.weightedRate / tv / 100 : 0,
      average_tenor: tv > 0 ? b.weightedTenor / tv : 0,
      average_duration: tv > 0 ? b.weightedDuration / tv : 0,
      total_value_fija: b.tvFija,
      total_value_ibr: b.tvIbr,
      total_value_uvr: b.tvUvr,
      average_irr_fija: b.tvFija > 0 ? b.wrFija / b.tvFija / 100 : 0,
      average_irr_ibr: b.tvIbr > 0 ? b.wrIbr / b.tvIbr / 100 : 0,
      average_irr_uvr: b.tvUvr > 0 ? b.wrUvr / b.tvUvr / 100 : 0,
      outdated_loan_count: 0,
      not_calculated_loan_count: 0,
    });
    gtv += tv; gac += b.accrued; gwr += b.weightedRate;
    gwt += b.weightedTenor; gwd += b.weightedDuration; glc += b.loanCount;
    gtvF += b.tvFija; gtvI += b.tvIbr; gtvU += b.tvUvr;
    gwrF += b.wrFija; gwrI += b.wrIbr; gwrU += b.wrUvr;
  });

  // Sort by total_value descending
  loanDebtData.sort((a, b) => b.total_value - a.total_value);

  const fullLoan: LoanData = {
    bank: '0',
    loan_ids: [],
    loan_count: glc,
    total_value: gtv,
    accrued_interest: gac,
    average_irr: gtv > 0 ? gwr / gtv / 100 : 0,
    average_tenor: gtv > 0 ? gwt / gtv : 0,
    average_duration: gtv > 0 ? gwd / gtv : 0,
    total_value_fija: gtvF,
    total_value_ibr: gtvI,
    total_value_uvr: gtvU,
    average_irr_fija: gtvF > 0 ? gwrF / gtvF / 100 : 0,
    average_irr_ibr: gtvI > 0 ? gwrI / gtvI / 100 : 0,
    average_irr_uvr: gtvU > 0 ? gwrU / gtvU / 100 : 0,
    outdated_loan_count: 0,
    not_calculated_loan_count: 0,
  };

  return { fullLoan, loanDebtData };
}

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

  setSelectedLoans: async ({
    selectedRows,
    filterDate,
  }: SelectedLoansDate<Loan>) => {
    set({
      loading: true,
      errorMessage: undefined,
      successMessage: undefined,
      selectedLoans: selectedRows.map((l) => l.id),
    });

    const total = selectedRows.length;
    if (total === 0) {
      set({
        loading: false,
        cashFlows: [],
        mergedCashFlows: [],
        fullLoan: undefined,
        loanDebtData: [],
        calculationProgress: { total: 0, completed: 0, calculating: false },
      });
      return;
    }

    // Start progress
    set({ calculationProgress: { total, completed: 0, calculating: true } });

    // Calculate each loan individually (batches of 5 in parallel)
    const batchSize = 5;
    const allCashFlows: CashFlowItem[] = [];
    const batches: Loan[][] = [];
    for (let i = 0; i < total; i += batchSize) {
      batches.push(selectedRows.slice(i, i + batchSize));
    }

    const processBatch = async (batch: Loan[]): Promise<CashFlowItem[]> => {
      const promises = batch.map(async (loan) => {
        const response: CashflowResponse = await fetchCashFlows(
          loan.id,
          loan.type,
          filterDate
        );
        if (!response.error && response.data) {
          return { loanId: loan.id, flows: response.data } as CashFlowItem;
        }
        return null;
      });
      const results = await Promise.all(promises);
      return results.filter((r): r is CashFlowItem => r !== null);
    };

    let completedCount = 0;
    // eslint-disable-next-line no-restricted-syntax
    for (const batch of batches) {
      // eslint-disable-next-line no-await-in-loop
      const batchResults = await processBatch(batch);
      batchResults.forEach((r) => allCashFlows.push(r));
      completedCount += batch.length;
      set({ calculationProgress: { total, completed: completedCount, calculating: true } });
    }

    // Build merged cashflows
    const newCashFlow: { [date: string]: LoanCashFlowIbr } = {};
    allCashFlows.forEach((item) => {
      item.flows.forEach((flow) => {
        const existing = newCashFlow[flow.date];
        if (existing) {
          newCashFlow[flow.date] = {
            principal: existing.principal + flow.principal,
            rate: existing.rate,
            date: flow.date,
            beginning_balance: existing.beginning_balance + flow.beginning_balance,
            payment: existing.payment + flow.payment,
            interest: existing.interest + flow.interest,
            ending_balance: existing.ending_balance + flow.ending_balance,
            rate_tot: existing.rate_tot,
          };
        } else {
          newCashFlow[flow.date] = { ...flow };
        }
      });
    });

    const mergedCashFlows = Object.values(newCashFlow).sort((a, b) =>
      a.date < b.date ? -1 : 1
    );

    // Build chart data
    const chartData: LightSerieValue[] = mergedCashFlows.map((v) => ({
      time: v.date.split(' ')[0],
      value: v.payment,
    }));

    // Build portfolio summary from individual cashflows
    const { fullLoan, loanDebtData } = buildPortfolioSummary(
      allCashFlows,
      selectedRows
    );

    set({
      cashFlows: allCashFlows,
      mergedCashFlows,
      chartData,
      fullLoan,
      loanDebtData,
      loading: false,
      calculationProgress: { total, completed: completedCount, calculating: false },
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
              interest: existing.interest + flow.interest,
              ending_balance: existing.ending_balance + flow.ending_balance,
              rate_tot: existing.rate_tot,
            };
            newCashFlow[newEntry.date] = newEntry;
          } else {
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
        return {
          loans: currentLoans.filter(({ id }) => !loanIds.includes(id)),
          successMessage: response.data?.message,
        };
      });
    }
  },
});

export default createLoansSlice;
