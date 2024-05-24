'use client';

import { ChangeEvent } from 'react';
import { Loan, LoanCashFlowIbr } from '@models/loans';
import { faEye, faTrash } from '@fortawesome/free-solid-svg-icons';
import styled from 'styled-components';
import LoanItem from './LoanItem';

type LoanListProps = {
  list: Loan[] | undefined;
  onSelect: (
    event: ChangeEvent<HTMLInputElement>,
    loanId: string,
    loanType: string
  ) => Promise<void>;
  isLoading: boolean;
  selected: Map<string, LoanCashFlowIbr[]>;
  onDelete: (loan: Loan) => void;
  onShowDetails: (loan: Loan) => void;
};

const ListContainer = styled.section`
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: scroll;
  height: 100%;
`;

const LoanList = ({
  list,
  onSelect,
  isLoading,
  selected,
  onDelete,
  onShowDetails,
}: LoanListProps) => (
  <ListContainer>
    {list?.map((loan) => (
      <LoanItem
        key={`row-key${loan.id}`}
        loan={loan}
        checked={selected.has(loan.id)}
        disabled={isLoading}
        onSelect={onSelect}
        actions={[
          {
            name: 'details',
            actionIcon: faEye,
            actionEvent: () => onShowDetails(loan),
          },
          {
            name: 'delete',
            actionIcon: faTrash,
            actionEvent: () => onDelete(loan),
          },
        ]}
      />
    ))}
  </ListContainer>
);

export default LoanList;
