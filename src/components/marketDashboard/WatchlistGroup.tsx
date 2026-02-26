import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { WatchlistEntry, WatchlistGroup as WatchlistGroupType } from 'src/types/watchlist';
import {
  GroupHeader,
  GroupColumnHeaders,
} from './styled/WatchlistGroupHeader.styled';
import WatchlistRow from './WatchlistRow';

type WatchlistGroupProps = {
  group: WatchlistGroupType;
  selectedTickers: Set<string>;
  chartColorMap: Map<string, string>;
  onRowClick: (entry: WatchlistEntry) => void;
};

const WatchlistGroup = React.memo(({
  group,
  selectedTickers,
  chartColorMap,
  onRowClick,
}: WatchlistGroupProps) => {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div>
      <GroupHeader onClick={() => setCollapsed(!collapsed)}>
        <span className="group-title">{group.name}</span>
        <div className="group-meta">
          <span className="group-count">{group.entries.length}</span>
          <FontAwesomeIcon
            icon={faChevronDown}
            className={`group-toggle ${collapsed ? 'collapsed' : ''}`}
          />
        </div>
      </GroupHeader>
      {!collapsed && (
        <>
          <GroupColumnHeaders>
            <span>Nombre</span>
            <span>Valor</span>
            <span>Chg</span>
            <span>%</span>
          </GroupColumnHeaders>
          {group.entries.map((entry) => (
            <WatchlistRow
              key={entry.ticker}
              entry={entry}
              isSelected={selectedTickers.has(entry.ticker)}
              chartColor={chartColorMap.get(entry.ticker)}
              onClick={onRowClick}
            />
          ))}
        </>
      )}
    </div>
  );
});

WatchlistGroup.displayName = 'WatchlistGroup';

export default WatchlistGroup;
