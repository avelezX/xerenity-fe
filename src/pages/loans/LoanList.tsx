'use client';

import { ChangeEvent, MouseEventHandler, useState, useRef } from 'react';
import { Form, Overlay, Tooltip } from 'react-bootstrap';
import IconButton from '@components/UI/IconButton';
import { Loan, LoanCashFlowIbr } from '@models/loans';
import tokens from 'design-tokens/tokens.json';
import {
  faEye,
  faTrash,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import styled from 'styled-components';
import Badge from '@components/UI/Badge';

const designSystem = tokens.xerenity;

const LIGHT_PURPLE = designSystem['purple-10'].value;
const GRAY_500 = designSystem['gray-500'].value;

type LoanAction = {
  actionIcon: IconDefinition;
  actionEvent: MouseEventHandler<HTMLButtonElement>;
  name: string;
};

type LoanItemProps = {
  loan: Loan;
  actions: LoanAction[];
  checked: boolean;
  disabled: boolean;
  onSelect: (
    event: ChangeEvent<HTMLInputElement>,
    loanId: string,
    loanType: string
  ) => void;
};

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
  list-decoration: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const ItemActions = styled.div`
  display: flex;
  gap: 10px;
`;

const BankItemName = styled.span`
  width: 15%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 14px;
`;

const ItemContainer = styled.div`
  height: 62px;
  background: #f3f3f3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2%;
  border-radius: 8px;
  padding: 0 10px;
`;

const ItemInformation = styled.div`
  display: flex;
  flex-direction: column;
  span {
    font-size: 14px;
  }
`;

const LoanItem = ({
  loan,
  actions,
  onSelect,
  checked,
  disabled,
}: LoanItemProps) => {
  const [showBankName, onShowBank] = useState<boolean>(false);
  const bankNameTarget = useRef(null);

  return (
    <ItemContainer>
      <Form.Check
        type="checkbox"
        checked={checked}
        id={`check-${loan.id}`}
        disabled={disabled}
        onChange={(e) => onSelect(e, loan.id, loan.type)}
      />
      <BankItemName
        style={{ cursor: 'pointer' }}
        ref={bankNameTarget}
        onMouseEnter={() => onShowBank(!showBankName)}
        onMouseLeave={() => onShowBank(!showBankName)}
      >
        {loan.bank}
      </BankItemName>
      <Overlay
        target={bankNameTarget.current}
        show={showBankName}
        placement="top"
      >
        <Tooltip>{loan.bank}</Tooltip>
      </Overlay>
      <Badge bg={LIGHT_PURPLE}>
        <span
          style={{
            textTransform: 'capitalize',
            fontSize: '14px',
            color: GRAY_500,
          }}
        >
          {loan.type}
        </span>
      </Badge>
      <ItemInformation>
        <span>{loan.original_balance}</span>
      </ItemInformation>
      <ItemInformation>
        <span>{loan.periodicity}</span>
      </ItemInformation>
      <ItemInformation>
        <span>{`${loan.interest_rate}%`}</span>
      </ItemInformation>
      <ItemActions>
        {actions?.map(({ name, actionIcon, actionEvent }) => (
          <IconButton key={name} onClick={actionEvent}>
            <Icon icon={actionIcon} />
          </IconButton>
        ))}
      </ItemActions>
    </ItemContainer>
  );
};

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
