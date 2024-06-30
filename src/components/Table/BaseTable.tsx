import { faSortAsc } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React from 'react';
import DataTable, { TableProps } from 'react-data-table-component';

const sortIcon = <FontAwesomeIcon icon={faSortAsc} />;

const selectProps = {
  indeterminate: (isIndeterminate: boolean) => isIndeterminate,
};

function DataTableBase<T>({
  columns,
  data,
  selectableRowsSingle,
  selectableRows,
  onSelectedRowsChange,
  expandableRows,
  expandableRowsComponent,
  conditionalRowStyles,
}: TableProps<T>): JSX.Element {
  return (
    <DataTable
      selectableRowsComponentProps={selectProps}
      sortIcon={sortIcon}
      highlightOnHover
      dense
      columns={columns}
      data={data}
      expandableRows={expandableRows}
      onSelectedRowsChange={onSelectedRowsChange}
      selectableRows={selectableRows}
      selectableRowsSingle={selectableRowsSingle}
      expandableRowsComponent={expandableRowsComponent}
      conditionalRowStyles={conditionalRowStyles}
    />
  );
}

export default DataTableBase;
