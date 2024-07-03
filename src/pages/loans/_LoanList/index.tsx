'use client';

import { CSSProperties } from 'react';
import { Loan } from 'src/types/loans';
import { faEye, faTrash } from '@fortawesome/free-solid-svg-icons';
import GroupList from '@components/UI/GroupList';
import ListItem from '@components/UI/GroupList/ListItem';
import currencyFormat from 'src/utils/currencyFormat';
import tokens from 'design-tokens/tokens.json';
import Badge from '@components/UI/Badge';

const designSystem = tokens.xerenity;
const PURPLE_200 = designSystem['purple-200'].value;
const WEIGHT_MD = designSystem.medium.value;

const badgeStyles: CSSProperties = {
  textTransform: 'capitalize',
  fontSize: '14px',
  color: 'white',
  fontWeight: '500',
};

type LoanListProps = {
  list: Loan[];
  onSelect: (loan: Loan, type: string) => void;
  isLoading: boolean;
  onDelete: (loan: Loan) => void;
  onShowDetails: (loan: Loan) => void;
};

const LoanList = ({
  list,
  onSelect,
  isLoading,
  onDelete,
  onShowDetails,
}: LoanListProps) => (
  <GroupList>
    {list?.map((loan) => (
      <ListItem
        id={loan.id}
        key={`row-key${loan.id}`}
        itemName={loan?.bank || ''}
        checked={loan.checked}
        disabled={isLoading}
        onSelect={() => onSelect(loan, loan.type)}
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
      >
        <>
          <Badge bg={PURPLE_200}>
            <span style={badgeStyles}>{loan?.type}</span>
          </Badge>
          <div className="item-information">
            <span style={{ fontWeight: WEIGHT_MD }}>
              {loan ? currencyFormat(loan.original_balance) : ''}
            </span>
          </div>
          <div className="item-information">
            <span>{loan?.periodicity}</span>
          </div>
          <div className="item-information">
            <span>{`${loan?.interest_rate}%`}</span>
          </div>
        </>
      </ListItem>
    ))}
  </GroupList>
);

export default LoanList;
