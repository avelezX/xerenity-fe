import { Loan } from 'src/types/loans';
import DataTableBase from '@components/Table/BaseTable';
import { TableSelectedRows } from '@components/Table/models';
import LoanListColumns from '../../../components/Table/columnDefinition/loans/_tableColumnDefinition';
import ExpandedComponent from '../_LoanDetailsModal';

type LoanListProps = {
  list: Loan[] | undefined;
  onSelect: ({
    allSelected,
    selectedCount,
    selectedRows,
  }: TableSelectedRows<Loan>) => void;
};

export default function LoanList({ list, onSelect }: LoanListProps) {
  return (
    <DataTableBase
      columns={LoanListColumns}
      data={list || []}
      fixedHeader
      selectableRows
      expandableRows
      onSelectedRowsChange={onSelect}
      expandableRowsComponent={ExpandedComponent}
    />
  );
}
