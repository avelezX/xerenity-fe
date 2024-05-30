'use client';

import { Canasta } from '@models/canasta';
import GroupList from '@components/UI/GroupList';
import CanastaItem from '../InflationItem';

type LoanListProps = {
  list: Canasta[] | undefined;
  onSelect: (
    canastaId: number,
  ) => Promise<void>;
  selected:number;
};

const CanastaList = ({
  list,
  onSelect,
  selected,
}: LoanListProps) => (
  <GroupList>
    {list?.map((canasta) => (
      <CanastaItem 
        key={`item-tr-${canasta.id}`}
        canasta={canasta} 
        checked={selected===canasta.id} 
        disabled={false} 
        onSelect={onSelect}
        />
    ))}
  </GroupList>
);

export default CanastaList;
