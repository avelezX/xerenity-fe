import { Loan } from 'src/types/loans';
import DataTableBase from '@components/Table/BaseTable';
import { TableSelectedRows } from 'src/types//models';
import LoanListColumns from '../../../components/Table/columnDefinition/loans/loanList/columns';
import ExpandedComponent from '../_LoanDetailsModal';

type LoanListProps = {
  list: Loan[];
  onSelect: ({
    allSelected,
    selectedCount,
    selectedRows,
  }: TableSelectedRows<Loan>) => void;
};

function LoanList({ list, onSelect }: LoanListProps) {
  return (
    <DataTableBase
      columns={LoanListColumns}
      data={list}
      fixedHeader
      selectableRows
      expandableRows
      onSelectedRowsChange={onSelect}
      expandableRowsComponent={ExpandedComponent}
    />
  );
}

export default LoanList;
