'use client';

import { ConsumerPrice } from '@models/consumerprice';
import GroupList from '@components/UI/GroupList';
import ConsumerPriceItem from '../InflationItem';

type ConsumerPriceListProps = {
  list: ConsumerPrice[] | undefined;
  onSelect: (
    priceId: number,
  ) => Promise<void>;
  selected:number;
};

const ConsumerPriceList = ({
  list,
  onSelect,
  selected,
}: ConsumerPriceListProps) => (
  <GroupList>
    {list?.map((cpi) => (
      <ConsumerPriceItem 
        key={`item-tr-${cpi.id}`}
        price={cpi} 
        checked={selected===cpi.id} 
        disabled={false} 
        onSelect={onSelect}
        />
    ))}
  </GroupList>
);

export default ConsumerPriceList;
