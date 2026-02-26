import React from 'react';
import { WatchlistEntry } from 'src/types/watchlist';
import {
  WatchlistRowContainer,
  ChangeValue,
} from './styled/WatchlistRowContainer.styled';

type WatchlistRowProps = {
  entry: WatchlistEntry;
  isSelected: boolean;
  chartColor?: string;
  onClick: (entry: WatchlistEntry) => void;
};

function formatValue(val: number | null): string {
  if (val === null) return '—';
  if (Math.abs(val) >= 1000) return val.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (Math.abs(val) >= 1) return val.toFixed(2);
  return val.toFixed(4);
}

function formatChange(val: number | null): string {
  if (val === null) return '—';
  const sign = val >= 0 ? '+' : '';
  if (Math.abs(val) >= 1) return `${sign}${val.toFixed(2)}`;
  return `${sign}${val.toFixed(4)}`;
}

function formatPct(val: number | null): string {
  if (val === null) return '—';
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(1)}%`;
}

const WatchlistRow = React.memo(({
  entry,
  isSelected,
  chartColor,
  onClick,
}: WatchlistRowProps) => (
  <WatchlistRowContainer
    isSelected={isSelected}
    selectedColor={chartColor}
    onClick={() => onClick(entry)}
  >
    <span className="row-name" title={entry.display_name}>
      {entry.display_name}
    </span>
    <span className="row-value">{formatValue(entry.latest_value)}</span>
    <ChangeValue positive={entry.change !== null ? entry.change >= 0 : null}>
      {formatChange(entry.change)}
    </ChangeValue>
    <ChangeValue
      positive={entry.pct_change !== null ? entry.pct_change >= 0 : null}
    >
      {formatPct(entry.pct_change)}
    </ChangeValue>
    <span className="row-remove">
      {isSelected ? '\u2715' : ''}
    </span>
  </WatchlistRowContainer>
));

WatchlistRow.displayName = 'WatchlistRow';

export default WatchlistRow;
