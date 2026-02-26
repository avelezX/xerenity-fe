import React, { useEffect, useMemo, useCallback } from 'react';
import { Container, Row, Col, Spinner } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PageTitle from '@components/PageTitle';
import useAppStore from 'src/store';
import { DashboardConfig, WatchlistEntry, WatchlistGroup } from 'src/types/watchlist';
import WatchlistPanel from './WatchlistPanel';
import PerformanceChart from './PerformanceChart';
import MarketDashboardToolbar from './MarketDashboardToolbar';

type MarketDashboardProps = {
  config: DashboardConfig;
};

function splitGroups(
  groups: WatchlistGroup[],
  leftNames?: string[],
  rightNames?: string[]
): { left: WatchlistGroup[]; right: WatchlistGroup[] } {
  if (leftNames && rightNames) {
    const leftSet = new Set(leftNames);
    const rightSet = new Set(rightNames);
    return {
      left: groups.filter((g) => leftSet.has(g.name)),
      right: groups.filter((g) => rightSet.has(g.name)),
    };
  }

  // Auto-split at midpoint
  const mid = Math.ceil(groups.length / 2);
  return {
    left: groups.slice(0, mid),
    right: groups.slice(mid),
  };
}

export default function MarketDashboard({ config }: MarketDashboardProps) {
  const watchlistGroups = useAppStore((s) => s.watchlistGroups);
  const watchlistLoading = useAppStore((s) => s.watchlistLoading);
  const valuesLoading = useAppStore((s) => s.valuesLoading);
  const chartSelections = useAppStore((s) => s.chartSelections);
  const fetchWatchlistSnapshot = useAppStore((s) => s.fetchWatchlistSnapshot);
  const addToChart = useAppStore((s) => s.addToChart);
  const removeFromChart = useAppStore((s) => s.removeFromChart);
  const resetMarketDashboard = useAppStore((s) => s.resetMarketDashboard);
  const searchText = useAppStore((s) => s.searchText);

  useEffect(() => {
    fetchWatchlistSnapshot(config);
    return () => {
      resetMarketDashboard();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter groups by search text
  const filteredGroups = useMemo(() => {
    if (!searchText) return watchlistGroups;
    const lower = searchText.toLowerCase();
    return watchlistGroups
      .map((g) => ({
        ...g,
        entries: g.entries.filter((e) =>
          e.display_name.toLowerCase().includes(lower)
        ),
      }))
      .filter((g) => g.entries.length > 0);
  }, [watchlistGroups, searchText]);

  const { left, right } = useMemo(
    () =>
      splitGroups(
        filteredGroups,
        config.leftPanelGroups,
        config.rightPanelGroups
      ),
    [filteredGroups, config.leftPanelGroups, config.rightPanelGroups]
  );

  const selectedTickers = useMemo(
    () => new Set(chartSelections.map((s) => s.ticker)),
    [chartSelections]
  );

  const chartColorMap = useMemo(
    () => new Map(chartSelections.map((s) => [s.ticker, s.color])),
    [chartSelections]
  );

  const handleRowClick = useCallback(
    (entry: WatchlistEntry) => {
      if (selectedTickers.has(entry.ticker)) {
        removeFromChart(entry.ticker);
      } else {
        addToChart(entry);
      }
    },
    [selectedTickers, addToChart, removeFromChart]
  );

  return (
    <Container fluid className="px-4">
      <Row>
        <Col>
          <PageTitle>
            <FontAwesomeIcon icon={config.icon} />
            <h4>{config.title}</h4>
            {(watchlistLoading || valuesLoading) && (
              <Spinner animation="border" size="sm" style={{ marginLeft: 8 }} />
            )}
          </PageTitle>
        </Col>
      </Row>
      <Row className="mb-3">
        <Col>
          <MarketDashboardToolbar config={config} />
        </Col>
      </Row>
      <Row>
        <Col sm={3}>
          <WatchlistPanel
            groups={left}
            selectedTickers={selectedTickers}
            chartColorMap={chartColorMap}
            onRowClick={handleRowClick}
          />
        </Col>
        <Col sm={6}>
          <PerformanceChart />
        </Col>
        <Col sm={3}>
          <WatchlistPanel
            groups={right}
            selectedTickers={selectedTickers}
            chartColorMap={chartColorMap}
            onRowClick={handleRowClick}
          />
        </Col>
      </Row>
    </Container>
  );
}
