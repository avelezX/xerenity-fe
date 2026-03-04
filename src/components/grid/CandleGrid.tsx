import React from 'react';
import tokens from 'design-tokens/tokens.json';
import { GridEntry } from 'src/types/tes';
import DataTableBase from '@components/Table/BaseDataTable';
import { SelectableRows } from 'src/types/selectableRows';
import GridColumns from '../Table/columnDefinition/grid/columns';

const designSystem = tokens.xerenity;
const SUCCESS_COLOR = designSystem['green-500'].value;
const DANGER_COLOR = designSystem['red-600'].value;

type GridViewProps = {
  allTes: GridEntry[];
  onSelect: ({
    selectedCount,
    selectedRows,
  }: SelectableRows<GridEntry>) => void;
};

const conditionalRowStyles = [
  {
    when: (row: GridEntry) => (row.close - row.prev) * 100 > 0,
    style: { backgroundColor: `${DANGER_COLOR}0D` },
  },
  {
    when: (row: GridEntry) => (row.close - row.prev) * 100 < 0,
    style: { backgroundColor: `${SUCCESS_COLOR}0D` },
  },
];

export default function CandleGridViewer({ onSelect, allTes }: GridViewProps) {
  return (
    <DataTableBase
      columns={GridColumns}
      data={allTes}
      selectableRowsSingle
      selectableRows
      onSelectedRowsChange={onSelect}
      conditionalRowStyles={conditionalRowStyles}
    />
  );
}
