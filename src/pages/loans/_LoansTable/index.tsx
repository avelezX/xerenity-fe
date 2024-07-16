import { Loan } from 'src/types/loans';
import BaseDataTable from '@components/Table/BaseDataTable';
import { SelectableRows } from 'src/types/selectableRows';
import LoanListColumns from '../../../components/Table/columnDefinition/loans/loanList/columns';
import ExpandedComponent from '../_LoanDetailsModal';

type LoanListProps = {
  list: Loan[];
  onSelect: ({ selectedCount, selectedRows }: SelectableRows<Loan>) => void;
};

function LoansTable({ list, onSelect }: LoanListProps) {
  return (
    <BaseDataTable
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

export default LoansTable;
