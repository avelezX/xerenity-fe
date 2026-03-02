import React, { useState } from 'react';
import styled from 'styled-components';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import tokens from 'design-tokens/tokens.json';
import { FicFundEntry, WatchlistEntry } from 'src/types/watchlist';
import { WatchlistRowContainer, ChangeValue } from './styled/WatchlistRowContainer.styled';

const designSystem = (tokens as { xerenity: Record<string, { value: string }> }).xerenity;

const FundHeader = styled.div<{ expanded: boolean }>`
  display: flex;
  align-items: center;
  padding: 5px 8px;
  font-size: 12px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  background: ${(props) => (props.expanded ? '#fafafa' : 'transparent')};
  gap: 6px;
  user-select: none;

  &:hover {
    background: ${designSystem['beige-50'].value};
  }

  .fund-chevron {
    font-size: 9px;
    color: #999;
    width: 10px;
    flex-shrink: 0;
  }

  .fund-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
    color: #333;
  }

  .fund-count {
    font-size: 10px;
    color: #aaa;
    white-space: nowrap;
    flex-shrink: 0;
  }
`;

const CompareButton = styled.button`
  font-size: 10px;
  padding: 1px 7px;
  background: none;
  border: 1px solid #ccc;
  border-radius: 3px;
  color: #666;
  cursor: pointer;
  flex-shrink: 0;
  line-height: 1.4;

  &:hover {
    border-color: ${designSystem['purple-300'].value};
    color: ${designSystem['purple-300'].value};
  }
`;

const SubRowContainer = styled(WatchlistRowContainer)`
  padding-left: 22px;
`;

function formatValue(val: number | null): string {
  if (val === null) return '—';
  if (Math.abs(val) >= 1000) return val.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (Math.abs(val) >= 1) return val.toFixed(4);
  return val.toFixed(6);
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

function getTipoLabel(entry: WatchlistEntry): string {
  const tipoNum = entry.source_name.split('_').at(-1);
  return `Tipo ${tipoNum}`;
}

type FicFundRowProps = {
  fund: FicFundEntry;
  selectedTickers: Set<string>;
  chartColorMap: Map<string, string>;
  onCompartimentoClick: (entry: WatchlistEntry) => void;
  onCompareFund: (fund: FicFundEntry) => void;
};

const FicFundRow = React.memo(({
  fund,
  selectedTickers,
  chartColorMap,
  onCompartimentoClick,
  onCompareFund,
}: FicFundRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const compartimentoCount = fund.compartimentos.length;

  return (
    <div>
      <FundHeader
        expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <FontAwesomeIcon
          icon={expanded ? faChevronDown : faChevronRight}
          className="fund-chevron"
        />
        <span className="fund-name" title={fund.fondoName}>
          {fund.fondoName}
        </span>
        <span className="fund-count">
          {compartimentoCount} comp.
        </span>
        <CompareButton
          onClick={(e) => {
            e.stopPropagation();
            onCompareFund(fund);
          }}
        >
          Comparar
        </CompareButton>
      </FundHeader>

      {expanded &&
        fund.compartimentos.map((entry) => {
          const isSelected = selectedTickers.has(entry.ticker);
          const chartColor = chartColorMap.get(entry.ticker);
          return (
            <SubRowContainer
              key={entry.ticker}
              isSelected={isSelected}
              selectedColor={chartColor}
              onClick={() => onCompartimentoClick(entry)}
            >
              <span className="row-name" title={entry.display_name}>
                {getTipoLabel(entry)}
              </span>
              <span className="row-value">{formatValue(entry.latest_value)}</span>
              <ChangeValue positive={entry.change !== null ? entry.change >= 0 : null}>
                {formatChange(entry.change)}
              </ChangeValue>
              <ChangeValue positive={entry.pct_change !== null ? entry.pct_change >= 0 : null}>
                {formatPct(entry.pct_change)}
              </ChangeValue>
              <span className="row-remove">{isSelected ? '\u2715' : ''}</span>
            </SubRowContainer>
          );
        })}
    </div>
  );
});

FicFundRow.displayName = 'FicFundRow';

export default FicFundRow;
