'use client';

import { Form } from 'react-bootstrap';

import { Canasta } from '@models/canasta';
import styled from 'styled-components';
import { ListItem, } from '@components/UI/GroupList';

type CanastaItemProps = {
    canasta: Canasta | undefined;
    checked: boolean;
    disabled: boolean;
    onSelect: (
        canastaId: number,
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

const CanastaItem = ({
    canasta,
    onSelect,
    checked,
    disabled,
}: CanastaItemProps) => (
    <ListItem isActive={checked}>
        <Form.Check
            type="checkbox"
            checked={checked}
            id={`check-${canasta?.id}`}
            disabled={disabled}
            onChange={() => canasta && onSelect(canasta.id)}
        />
        <ItemInformation >
            <span >{canasta?.nombre}</span>
        </ItemInformation>
    </ListItem>
);

export default CanastaItem;
