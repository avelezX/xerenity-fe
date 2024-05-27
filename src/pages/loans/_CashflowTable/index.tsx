import currencyFormat from 'src/utils/currencyFormat';
import { LoanCashFlowIbr } from '@models/loans';
import { Table } from 'react-bootstrap';
import { TableCell,TableHeader,TableRow,HeaderCell } from '@components/UI/Table';

type CashFlowTableProps = {
  data: LoanCashFlowIbr[] | undefined;
};

// TODO: Implement a shared common Table component
const CashFlowTable = ({ data }: CashFlowTableProps) => (
  <div style={{ height: '800px', overflowY: 'scroll' }}>
    <Table hover>
      <TableHeader>
        <TableRow>
          <HeaderCell>Moneda</HeaderCell>
          <HeaderCell>Tasa</HeaderCell>
          <HeaderCell>Fecha de inicio</HeaderCell>
          <HeaderCell alignRight>Balance inicial</HeaderCell>
          <HeaderCell alignRight>Pago cuota</HeaderCell>
          <HeaderCell alignRight>Intereses</HeaderCell>
          <HeaderCell alignRight>Principal</HeaderCell>
          <HeaderCell alignRight>Balance Final</HeaderCell>
        </TableRow>
      </TableHeader>
      <tbody>
        {data?.map(
          ({
            date,
            rate,
            rate_tot,
            beginning_balance,
            payment,
            interest,
            principal,
            ending_balance,
          }) => [
            <TableRow key={`row-credit-${date}-${ending_balance}`}>
              <TableCell>COP</TableCell>
              <TableCell>
                {rate_tot ? rate_tot.toFixed(2) : rate.toFixed(2)}%
              </TableCell>
              <TableCell>{date.split(' ')[0]}</TableCell>
              <TableCell alignRight>
                {currencyFormat(beginning_balance)}
              </TableCell>
              <TableCell alignRight>{currencyFormat(payment)}</TableCell>
              <TableCell alignRight>{currencyFormat(interest)}</TableCell>
              <TableCell alignRight>{currencyFormat(principal)}</TableCell>
              <TableCell alignRight>{currencyFormat(ending_balance)}</TableCell>
            </TableRow>,
          ]
        )}
      </tbody>
    </Table>
  </div>
);

export default CashFlowTable;
