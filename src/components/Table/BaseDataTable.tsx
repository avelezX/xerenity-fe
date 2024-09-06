import React from 'react';
import { faSortAsc } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import DataTable, { TableProps } from 'react-data-table-component';

const sortIcon = <FontAwesomeIcon icon={faSortAsc} />;

const customStyles = {
  headCells: {
    style: {
      fontSize: '16px',
      padding: '16px 10px',
    },
  },
  cells: {
    style: {
      fontSize: '16px',
      padding: '16px 10px',
    },
  },
};

function BaseDataTable<T>({
  columns,
  data,
  selectableRowsSingle,
  selectableRows,
  onSelectedRowsChange,
  expandableRows,
  expandableRowsComponent,
  conditionalRowStyles,
  subHeaderComponent,
  actions,
}: TableProps<T>): JSX.Element {
  return (
    <DataTable
      sortIcon={sortIcon}
      highlightOnHover
      dense
      data={data}
      columns={columns}
      customStyles={customStyles}
      selectableRows={selectableRows}
      expandableRows={expandableRows}
      subHeaderComponent={subHeaderComponent}
      onSelectedRowsChange={onSelectedRowsChange}
      selectableRowsSingle={selectableRowsSingle}
      conditionalRowStyles={conditionalRowStyles}
      expandableRowsComponent={expandableRowsComponent}
      selectableRowsNoSelectAll
      actions={actions}
    />
  );
}

export default BaseDataTable;
