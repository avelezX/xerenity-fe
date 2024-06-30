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
  subHeaderComponent,
}: TableProps<T>): JSX.Element {
  return (
    <DataTable
      selectableRowsComponentProps={selectProps}
      sortIcon={sortIcon}
      highlightOnHover
      dense
      data={data}
      columns={columns}
      selectableRows={selectableRows}
      expandableRows={expandableRows}
      subHeaderComponent={subHeaderComponent}
      onSelectedRowsChange={onSelectedRowsChange}
      selectableRowsSingle={selectableRowsSingle}
      conditionalRowStyles={conditionalRowStyles}
      expandableRowsComponent={expandableRowsComponent}
    />
  );
}

export default DataTableBase;
