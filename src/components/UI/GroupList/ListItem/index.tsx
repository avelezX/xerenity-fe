'use client';

import {
  useState,
  useRef,
  MouseEventHandler,
  PropsWithChildren,
  ChangeEvent,
  isValidElement,
} from 'react';
import { Form, Overlay, Tooltip } from 'react-bootstrap';
import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import truncateStr from 'src/utils/truncateStr';
import IconButton from '../../IconButton';
import ListItemActions from './ListItemActions.styled';
import ListItemContainer from './ListItemContainer.styled';
import ItemName from './ItemName.styled';

type ItemAction = {
  actionIcon: IconDefinition;
  actionEvent: MouseEventHandler<HTMLButtonElement>;
  name: string;
};

type ListItemProps = {
  actions?: ItemAction[];
  checked: boolean;
  justifyContent?: string;
  itemName: string;
  truncateNumber?: number;
  disabled?: boolean;
  id: string | number;
  onSelect: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
} & PropsWithChildren;

const ListItem = ({
  actions,
  disabled,
  children,
  checked,
  justifyContent,
  itemName,
  truncateNumber,
  id,
  onSelect,
}: ListItemProps) => {
  const [showName, onShowName] = useState<boolean>(false);
  const itemNameTarget = useRef(null);

  return (
    <ListItemContainer isActive={checked} justifyContent={justifyContent}>
      <Form.Check
        type="checkbox"
        checked={checked}
        id={`list-item-check-${id}`}
        disabled={disabled}
        onChange={onSelect}
      />
      <ItemName
        hasChildren={isValidElement(children)}
        ref={itemNameTarget}
        onMouseEnter={() => onShowName(!showName)}
        onMouseLeave={() => onShowName(!showName)}
      >
        {truncateNumber ? truncateStr(itemName, truncateNumber) : itemName}
      </ItemName>
      <Overlay target={itemNameTarget.current} show={showName} placement="top">
        <Tooltip>{itemName}</Tooltip>
      </Overlay>
      {children}
      <ListItemActions>
        {actions?.map(({ name, actionIcon, actionEvent }) => (
          <IconButton key={name} onClick={actionEvent}>
            <Icon icon={actionIcon} />
          </IconButton>
        ))}
      </ListItemActions>
    </ListItemContainer>
  );
};

export default ListItem;
