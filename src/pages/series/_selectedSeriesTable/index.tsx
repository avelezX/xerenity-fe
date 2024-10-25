import BaseDataTable from '@components/Table/BaseDataTable';
import { LightSerie } from 'src/types/lightserie';

import SelectedSerieListColumns from '@components/Table/columnDefinition/series/seectedColumns';

type LoanListProps = {
  list: LightSerie[];
};

const SelectedSeriesTable = ({ list }: LoanListProps) => (
  <BaseDataTable columns={SelectedSerieListColumns} data={list} fixedHeader />
);

export default SelectedSeriesTable;
