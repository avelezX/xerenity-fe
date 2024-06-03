'use client';

import { Form, Overlay, Tooltip } from 'react-bootstrap';
import { ConsumerPrice } from '@models/consumerprice';
import styled from 'styled-components';
import { ListItem } from '@components/UI/GroupList';
import { useRef, useState } from 'react';
import truncateStr from 'src/utils/truncateStr';

type ConsumerPriceItemProps = {
  price: ConsumerPrice | undefined;
  checked: boolean;
  disabled: boolean;
  onSelect: (priceId: number) => void;
};

const ItemInformation = styled.div`
  display: flex;
  flex-direction: column;
  span {
    font-size: 14px;
    align-items: center;
    justify-content: center;
    text-indent: unset;
    white-space: nowrap;
  }
`;

const ConsumerPriceItem = ({
  price,
  onSelect,
  checked,
  disabled,
}: ConsumerPriceItemProps) => {
  const [showName, onShowName] = useState<boolean>(false);
  const itemNameTarget = useRef(null);
  return (
    <ListItem isActive={checked} justifyContent="start">
      <Form.Check
        type="checkbox"
        checked={checked}
        id={`check-${price?.id}`}
        disabled={disabled}
        onChange={() => price && onSelect(price.id)}
      />
      <ItemInformation>
        <span
          style={{ cursor: 'pointer' }}
          ref={itemNameTarget}
          onMouseEnter={() => onShowName(!showName)}
          onMouseLeave={() => onShowName(!showName)}
        >
          <strong>{truncateStr(price?.nombre, 50)}</strong>
        </span>
        <Overlay
          target={itemNameTarget.current}
          show={showName}
          placement="top"
        >
          <Tooltip>{price?.nombre}</Tooltip>
        </Overlay>
      </ItemInformation>
    </ListItem>
  );
};

export default ConsumerPriceItem;
