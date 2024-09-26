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
    name: 'Irr',
    selector: (row: LoanData) => currencyFormat(row.average_irr),
    sortable: true,
  },
  {
    name: 'Tenor',
    selector: (row: LoanData) => currencyFormat(row.average_tenor),
    sortable: true,
  },
  {
    name: 'Irr IBR',
    selector: (row: LoanData) => currencyFormat(row.average_irr_ibr),
    sortable: true,
  },
  {
    name: 'Intereses',
    selector: (row: LoanData) => currencyFormat(row.accrued_interest),
    sortable: true,
  },
  {
    name: 'Duracion',
    selector: (row: LoanData) => currencyFormat(row.average_duration),
    sortable: true,
  },
  {
    name: 'IRR Fija',
    selector: (row: LoanData) => currencyFormat(row.average_irr_fija),
    sortable: true,
  },
  {
    name: 'Valor Total IBR',
    selector: (row: LoanData) => currencyFormat(row.total_value_ibr),
    sortable: true,
  },
  {
    name: 'Valor Fija',
    selector: (row: LoanData) => currencyFormat(row.total_value_fija),
    sortable: true,
  },
  {
    name: 'Valor Total',
    selector: (row: LoanData) => currencyFormat(row.total_value),
    sortable: true,
  },
];

export default LoanDebtListColumns;
