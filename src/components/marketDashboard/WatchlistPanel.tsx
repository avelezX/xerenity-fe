import React from 'react';
import { WatchlistEntry, WatchlistGroup as WatchlistGroupType } from 'src/types/watchlist';
import WatchlistPanelContainer from './styled/WatchlistPanelContainer.styled';
import WatchlistGroup from './WatchlistGroup';

type WatchlistPanelProps = {
  groups: WatchlistGroupType[];
  selectedTickers: Set<string>;
  chartColorMap: Map<string, string>;
  onRowClick: (entry: WatchlistEntry) => void;
};

export default function WatchlistPanel({
  groups,
  selectedTickers,
  chartColorMap,
  onRowClick,
}: WatchlistPanelProps) {
  return (
    <WatchlistPanelContainer>
      {groups.map((group) => (
        <WatchlistGroup
          key={group.name}
          group={group}
          selectedTickers={selectedTickers}
          chartColorMap={chartColorMap}
          onRowClick={onRowClick}
        />
      ))}
      {groups.length === 0 && (
        <div style={{ padding: 16, textAlign: 'center', color: '#999', fontSize: 12 }}>
          No hay series disponibles
        </div>
      )}
    </WatchlistPanelContainer>
  );
}
