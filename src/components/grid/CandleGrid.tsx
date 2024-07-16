import React from 'react';
import { GridEntry } from 'src/types/tes';
import DataTableBase from '@components/Table/BaseDataTable';
import { SelectableRows } from 'src/types/selectableRows';
import GridColumns from '../Table/columnDefinition/grid/columns';

type GridViewProps = {
  allTes: GridEntry[];
  onSelect: ({
    selectedCount,
    selectedRows,
  }: SelectableRows<GridEntry>) => void;
};

export default function CandleGridViewer({ onSelect, allTes }: GridViewProps) {
  return (
    <DataTableBase
      columns={GridColumns}
      data={allTes}
      selectableRowsSingle
      selectableRows
      onSelectedRowsChange={onSelect}
    />
  );
}
