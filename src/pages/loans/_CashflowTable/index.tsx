import currencyFormat from 'src/utils/currencyFormat';
import { LoanCashFlowIbr } from 'src/types/loans';
import DataTableBase from '@components/Table/BaseTable';

type CashFlowTableProps = {
  data: LoanCashFlowIbr[];
};

function rateTotal(row: LoanCashFlowIbr) {
  return row.rate_tot ? row.rate_tot.toFixed(2) : row.rate.toFixed(2);
}

const columns = [
  {
    name: 'Tasa',
    selector: (row: LoanCashFlowIbr) => rateTotal(row),
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

// TODO: Implement a shared common Table component
const CashFlowTable = ({ data }: CashFlowTableProps) => (
  <div style={{ height: '800px', overflowY: 'scroll' }}>
    <DataTableBase columns={columns} data={data || []} />
  </div>
);

export default CashFlowTable;
