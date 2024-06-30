import { LightSerieValue } from 'src/types/lightserie';

import DataTableBase from '@components/Table/BaseTable';
import InflationColumns from './_tableColumnDefinition';

type InflationTableProps = {
  data: LightSerieValue[] | undefined;
};

// TODO: Implement a shared common Table component
const InflationTable = ({ data }: InflationTableProps) => (
  <div style={{ height: '800px', overflowY: 'scroll' }}>
    <DataTableBase columns={InflationColumns} data={data || []} fixedHeader />
  </div>
);

export default InflationTable;
