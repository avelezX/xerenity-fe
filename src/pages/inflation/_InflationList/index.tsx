'use client';

import { ConsumerPrice } from '@models/consumerprice';
import GroupList from '@components/UI/GroupList';
import InflationItem from './InflationItem';

type InflationListProps = {
  list: ConsumerPrice[] | undefined;
  onSelect: (priceId: number) => Promise<void>;
  selected: number;
};

const InflationList = ({ list, onSelect, selected }: InflationListProps) => (
  <GroupList>
    {list?.map((cpi) => (
      <InflationItem
        key={`item-tr-${cpi.id}`}
        price={cpi}
        checked={selected === cpi.id}
        onSelect={onSelect}
      />
    ))}
  </GroupList>
);

export default InflationList;
