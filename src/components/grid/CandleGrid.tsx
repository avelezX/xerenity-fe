import React from 'react';
import { GridEntry } from 'src/types/tes';
import DataTableBase from '@components/Table/BaseTable';
import { TableSelectedRows } from 'src/types//models';
import GridColumns from '../Table/columnDefinition/grid/columns';

type GridViewProps = {
  allTes: GridEntry[];
  onSelect: ({
    allSelected,
    selectedCount,
    selectedRows,
  }: TableSelectedRows<GridEntry>) => void;
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
