import { Table } from 'react-bootstrap';
import { TableCell,TableHeader,TableRow,HeaderCell } from '@components/UI/Table';
import { LightSerieValue } from '@models/lightserie';

type InflationTableProps = {
  data: LightSerieValue[] | undefined;
  meses: number;
};

// TODO: Implement a shared common Table component
const InflationTable = ({ data ,meses }: InflationTableProps) => (
  <div style={{ height: '800px', overflowY: 'scroll' }}>
    <Table hover>
      <TableHeader>
        <TableRow>
          <HeaderCell>Fecha</HeaderCell>
          <HeaderCell>Cambio % IPC {meses} meses </HeaderCell>
        </TableRow>
      </TableHeader>
      <tbody>
        {data?.map(
          ({
            time,
            value,
          }) => [
            <TableRow key={`row-credit-${time}`}>
              <TableCell>
                {time}
              </TableCell>
              <TableCell>
                {value.toFixed(2)}
              </TableCell>
            </TableRow>,
          ]
        )}
      </tbody>
    </Table>
  </div>
);

export default InflationTable;
