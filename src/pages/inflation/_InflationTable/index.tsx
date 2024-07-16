import { LightSerieValue } from 'src/types/lightserie';

import DataTableBase from '@components/Table/BaseDataTable';
import InflationColumns from '../../../components/Table/columnDefinition/inflation/columns';

type InflationTableProps = {
  data: LightSerieValue[];
};

// TODO: Implement a shared common Table component
const InflationTable = ({ data }: InflationTableProps) => (
  <div style={{ height: '800px', overflowY: 'scroll' }}>
    <DataTableBase columns={InflationColumns} data={data} fixedHeader />
  </div>
);

export default InflationTable;
