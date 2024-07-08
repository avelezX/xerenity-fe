import { LoanCashFlowIbr } from 'src/types/loans';
import currencyFormat from 'src/utils/currencyFormat';

const CashFlowListColumns = [
  {
    name: 'Moneda',
    selector: () => 'cop',
    sortable: true,
  },
  {
    name: 'Tasa',
    selector: (row: LoanCashFlowIbr) =>
      row.rate_tot ? `${row.rate_tot.toFixed(2)}%` : `${row.rate.toFixed(2)}%`,
    sortable: true,
  },
  {
    name: 'Fecha de inicio',
    selector: (row: LoanCashFlowIbr) => row.date.split(' ')[0],
    sortable: true,
  },
  {
    name: 'Balance inicial',
    selector: (row: LoanCashFlowIbr) => currencyFormat(row.beginning_balance),
    sortable: true,
  },
  {
    name: 'Pago cuota',
    selector: (row: LoanCashFlowIbr) => currencyFormat(row.payment),
    sortable: true,
  },
  {
    name: 'Intereses',
    selector: (row: LoanCashFlowIbr) => currencyFormat(row.interest),
    sortable: true,
  },
  {
    name: 'Principal',
    selector: (row: LoanCashFlowIbr) => currencyFormat(row.principal),
    sortable: true,
  },
  {
    name: 'Balance Final',
    selector: (row: LoanCashFlowIbr) => currencyFormat(row.ending_balance),
    sortable: true,
  },
];

export default CashFlowListColumns;
