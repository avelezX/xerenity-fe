import { Loan } from 'src/types/loans';
import currencyFormat from 'src/utils/currencyFormat';

const LoanListColumns = [
  {
    name: 'Contraparte',
    selector: (row: Loan) => row.bank,
    sortable: true,
  },
  {
    name: 'Fecha de inicio',
    selector: (row: Loan) => row.start_date,
    sortable: true,
  },
  {
    name: 'Monto',
    selector: (row: Loan) => currencyFormat(row.original_balance),
    sortable: true,
  },
  {
    name: 'Tipo de tasa',
    selector: (row: Loan) => row.type,
    sortable: true,
  },
  {
    name: 'Periodicidad',
    selector: (row: Loan) => row.periodicity,
    sortable: true,
  },
  {
    name: 'Periodos',
    selector: (row: Loan) => row.number_of_payments,
    sortable: true,
  },
  {
    name: 'Tasa nominal',
    selector: (row: Loan) =>
      row.type === 'fija' ? `${row.interest_rate}%` : row.type,
    sortable: true,
  },
  {
    name: 'Spread',
    selector: (row: Loan) =>
      row.type === 'fija' ? '0.00%' : `${row.interest_rate}%`,
    sortable: true,
    button: true,
  },
];

export default LoanListColumns;
