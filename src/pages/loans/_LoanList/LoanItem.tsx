'use client';

import { useState, useRef, ChangeEvent, MouseEventHandler } from 'react';
import { Form, Overlay, Tooltip } from 'react-bootstrap';
import IconButton from '@components/UI/IconButton';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import Badge from '@components/UI/Badge';
import tokens from 'design-tokens/tokens.json';
import { Loan } from '@models/loans';
import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import styled from 'styled-components';
import { ListItem, ListItemActions } from '@components/UI/GroupList';
import currencyFormat from 'src/utils/currencyFormat';

const designSystem = tokens.xerenity;
const PURPLE_200 = designSystem['purple-200'].value;

type LoanAction = {
  actionIcon: IconDefinition;
  actionEvent: MouseEventHandler<HTMLButtonElement>;
  name: string;
};

type LoanItemProps = {
  loan: Loan | undefined;
  actions: LoanAction[];
  checked: boolean;
  disabled: boolean;
  onSelect: (
    event: ChangeEvent<HTMLInputElement>,
    loanId: string,
    loanType: string
  ) => void;
};

const BankItemName = styled.span`
  width: 25%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 14px;
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
    <ListItem isActive={checked}>
      <Form.Check
        type="checkbox"
        checked={checked}
        id={`check-${loan?.id}`}
        disabled={disabled}
        onChange={(e) => loan && onSelect(e, loan.id, loan.type)}
      />
      <BankItemName
        style={{ cursor: 'pointer' }}
        ref={bankNameTarget}
        onMouseEnter={() => onShowBank(!showBankName)}
        onMouseLeave={() => onShowBank(!showBankName)}
      >
        {loan?.bank}
      </BankItemName>
      <Overlay
        target={bankNameTarget.current}
        show={showBankName}
        placement="top"
      >
        <Tooltip>{loan?.bank}</Tooltip>
      </Overlay>
      <Badge bg={PURPLE_200}>
        <span
          style={{
            textTransform: 'capitalize',
            fontSize: '14px',
            color: 'white',
            fontWeight: '500',
          }}
        >
          {loan?.type}
        </span>
      </Badge>
      <ItemInformation>
        <span>
          <strong>{loan ? currencyFormat(loan.original_balance) : ''}</strong>
        </span>
      </ItemInformation>
      <ItemInformation>
        <span>{loan?.periodicity}</span>
      </ItemInformation>
      <ItemInformation>
        <span>{`${loan?.interest_rate}%`}</span>
      </ItemInformation>
      <ListItemActions>
        {actions?.map(({ name, actionIcon, actionEvent }) => (
          <IconButton key={name} onClick={actionEvent}>
            <Icon icon={actionIcon} />
          </IconButton>
        ))}
      </ListItemActions>
    </ListItem>
  );
};

export default LoanItem;
