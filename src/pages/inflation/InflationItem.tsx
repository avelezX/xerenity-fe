'use client';

import { Form } from 'react-bootstrap';

import { ConsumerPrice } from '@models/consumerprice';
import styled from 'styled-components';
import { ListItem, } from '@components/UI/GroupList';

type ConsumerPriceItemProps = {
    price: ConsumerPrice | undefined;
    checked: boolean;
    disabled: boolean;
    onSelect: (
        priceId: number,
    ) => void;
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
}: ConsumerPriceItemProps) => (
    <ListItem isActive={checked}>
        <Form.Check
            type="checkbox"
            checked={checked}
            id={`check-${price?.id}`}
            disabled={disabled}
            onChange={() => price && onSelect(price.id)}
        />
        <ItemInformation >
            <span >{price?.nombre}</span>
        </ItemInformation>
    </ListItem>
);

export default ConsumerPriceItem;
