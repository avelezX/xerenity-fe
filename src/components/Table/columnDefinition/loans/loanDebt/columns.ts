import { LoanData } from 'src/types/loans';
import currencyFormat from 'src/utils/currencyFormat';

const LoanDebtListColumns = [
  {
    name: 'Banco',
    selector: (row: LoanData) => row.bank,
    sortable: true,
  },
  {
    name: 'Creditos',
    selector: (row: LoanData) => row.loan_count,
    sortable: true,
  },
  {
    name: 'WAC IRR',
    selector: (row: LoanData) => currencyFormat(row.average_irr * 100),
    sortable: true,
  },
  {
    name: 'WACC IBR (IRR)',
    selector: (row: LoanData) => currencyFormat(row.average_irr_ibr),
    sortable: true,
  },
  {
    name: 'Spread',
    selector: () => 'Falta',
    sortable: true,
  },
  {
    name: 'Tenor',
    selector: (row: LoanData) => currencyFormat(row.average_tenor),
    sortable: true,
  },
];

export default LoanDebtListColumns;
