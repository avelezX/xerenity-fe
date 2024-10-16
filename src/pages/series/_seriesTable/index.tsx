import BaseDataTable from '@components/Table/BaseDataTable';
import { SelectableRows } from 'src/types/selectableRows';
import { LightSerieEntry } from 'src/types/lightserie';

import SerieListColumns from '@components/Table/columnDefinition/series/columns';

type LoanListProps = {
  list: LightSerieEntry[];
  onSelect: ({
    selectedCount,
    selectedRows,
  }: SelectableRows<LightSerieEntry>) => void;
};

const SeriesTable = ({ list, onSelect }: LoanListProps) => (
  <BaseDataTable
    columns={SerieListColumns}
    data={list}
    fixedHeader
    selectableRows
    onSelectedRowsChange={onSelect}
  />
);

export default SeriesTable;
