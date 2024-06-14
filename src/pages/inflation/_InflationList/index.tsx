'use client';

import { ConsumerPrice } from 'src/types/consumerprice';
import GroupList from '@components/UI/GroupList';
import ListItem from '@components/UI/GroupList/ListItem';

type InflationListProps = {
  list: ConsumerPrice[] | undefined;
  onSelect: (priceId: number) => Promise<void>;
  selected: number;
};

const InflationList = ({ list, onSelect, selected }: InflationListProps) => (
  <GroupList>
    {list?.map((item) => (
      <ListItem
        id={item.id}
        itemName={item.nombre}
        key={`item-tr-${item.id}`}
        checked={selected === item.id}
        onSelect={() => item && onSelect(item.id)}
        justifyContent="start"
      />
    ))}
  </GroupList>
);

export default InflationList;
