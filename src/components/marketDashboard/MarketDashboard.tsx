import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Container, Row, Col, Spinner } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Step } from 'react-joyride';
import PageTitle from '@components/PageTitle';
import useAppStore from 'src/store';
import { DashboardConfig, FicFundEntry, WatchlistEntry, WatchlistGroup } from 'src/types/watchlist';
import { buildFicHierarchy } from 'src/store/marketDashboard';
import WatchlistPanel from './WatchlistPanel';
import PerformanceChart from './PerformanceChart';
import MarketDashboardToolbar from './MarketDashboardToolbar';
import OnboardingTour from './OnboardingTour';
import { TabsContainer, TabLink, InfoLink } from './styled/DashboardTabs.styled';

function groupEntries(
  entries: WatchlistEntry[],
  groupByField: DashboardConfig['groupByField']
): WatchlistGroup[] {
  const map = new Map<string, WatchlistEntry[]>();
  entries.forEach((e) => {
    const key = (e[groupByField] as string) || 'Otros';
    const existing = map.get(key);
    if (existing) existing.push(e);
    else map.set(key, [e]);
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, items]) => ({
      name,
      entries: items.sort((a, b) =>
        a.display_name.localeCompare(b.display_name)
      ),
    }));
}

const DASHBOARD_TABS = [
  { label: 'BanRep', path: '/suameca' },
  { label: 'Tasas', path: '/tasas' },
  { label: 'Monedas', path: '/monedas-dashboard' },
  { label: 'FIC', path: '/fic' },
  { label: 'Peru', path: '/peru' },
  { label: 'Par de Monedas', path: '/par-monedas' },
];

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
  const router = useRouter();
  const watchlistEntries = useAppStore((s) => s.watchlistEntries);
  const watchlistLoading = useAppStore((s) => s.watchlistLoading);
  const valuesLoading = useAppStore((s) => s.valuesLoading);
  const chartSelections = useAppStore((s) => s.chartSelections);
  const fetchWatchlistSnapshot = useAppStore((s) => s.fetchWatchlistSnapshot);
  const addToChart = useAppStore((s) => s.addToChart);
  const addFundToChart = useAppStore((s) => s.addFundToChart);
  const removeFromChart = useAppStore((s) => s.removeFromChart);
  const resetWatchlistOnly = useAppStore((s) => s.resetWatchlistOnly);
  const searchText = useAppStore((s) => s.searchText);
  const entidadFilter = useAppStore((s) => s.entidadFilter);
  const activoFilter = useAppStore((s) => s.activoFilter);
  const tipoFondoFilter = useAppStore((s) => s.tipoFondoFilter);
  const claseActivoFilter = useAppStore((s) => s.claseActivoFilter);
  const [panelsVisible, setPanelsVisible] = useState(true);

  const tourSteps: Step[] = useMemo(
    () => [
      {
        target: '[data-tour="watchlist-left"]',
        content:
          'Estas son las series disponibles. Haz click en cualquiera para agregarla al gráfico.',
        disableBeacon: true,
      },
      {
        target: '[data-tour="chart-area"]',
        content:
          'El gráfico muestra las series seleccionadas. Puedes agregar varias al mismo tiempo para compararlas.',
      },
      {
        target: '[data-tour="legend-area"]',
        content:
          'Cada serie aparece aquí con su color. Haz click en la ✕ para quitarla del gráfico.',
      },
      {
        target: '[data-tour="dashboard-toolbar"]',
        content:
          'Cambia el periodo de tiempo, busca series por nombre, normaliza el gráfico para comparar escalas diferentes, u oculta los paneles laterales.',
      },
    ],
    []
  );

  useEffect(() => {
    fetchWatchlistSnapshot(config);
    return () => {
      resetWatchlistOnly();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Unique entidades for the filter dropdown
  const uniqueEntidades = useMemo(() => {
    const set = new Set<string>();
    watchlistEntries.forEach((e) => {
      if (e.entidad) set.add(e.entidad);
    });
    return Array.from(set).sort();
  }, [watchlistEntries]);

  // Unique tipos de fondo for the filter dropdown (FIC only)
  const uniqueTiposFondo = useMemo(() => {
    const set = new Set<string>();
    watchlistEntries.forEach((e) => {
      if (e.tipo_fondo) set.add(e.tipo_fondo);
    });
    return Array.from(set).sort();
  }, [watchlistEntries]);

  // Unique clases de activo for the filter dropdown (FIC only)
  const uniqueClasesActivo = useMemo(() => {
    const set = new Set<string>();
    watchlistEntries.forEach((e) => {
      if (e.clase_activo) set.add(e.clase_activo);
    });
    return Array.from(set).sort();
  }, [watchlistEntries]);

  // Filter + group from raw entries (reactive to all filters)
  const filteredGroups = useMemo(() => {
    let entries = watchlistEntries;

    if (searchText) {
      const lower = searchText.toLowerCase();
      entries = entries.filter((e) =>
        e.display_name.toLowerCase().includes(lower)
      );
    }
    if (entidadFilter) {
      entries = entries.filter((e) => e.entidad === entidadFilter);
    }
    if (activoFilter) {
      entries = entries.filter((e) => e.activo !== false);
    }
    if (tipoFondoFilter) {
      entries = entries.filter((e) => e.tipo_fondo === tipoFondoFilter);
    }
    if (claseActivoFilter) {
      entries = entries.filter((e) => e.clase_activo === claseActivoFilter);
    }

    return groupEntries(entries, config.groupByField);
  }, [watchlistEntries, searchText, entidadFilter, activoFilter, tipoFondoFilter, claseActivoFilter, config.groupByField]);

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

  const filteredEntries = useMemo(
    () => filteredGroups.flatMap((g) => g.entries),
    [filteredGroups]
  );

  const ficFunds = useMemo(
    () => config.ficHierarchical ? buildFicHierarchy(filteredEntries) : [],
    [filteredEntries, config.ficHierarchical]
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

  const handleCompareFund = useCallback(
    (fund: FicFundEntry) => {
      addFundToChart(fund.compartimentos);
    },
    [addFundToChart]
  );

  return (
    <Container fluid className="px-4">
      <OnboardingTour storageKey="tour-market-dashboard" steps={tourSteps} />
      <Row className="align-items-center justify-content-between">
        <Col xs="auto">
          <PageTitle>
            <FontAwesomeIcon icon={config.icon} />
            <h4>{config.title}</h4>
            {config.infoPath && (
              <Link href={config.infoPath} passHref legacyBehavior>
                <InfoLink title="Guía técnica">
                  <FontAwesomeIcon icon={faCircleInfo} />
                </InfoLink>
              </Link>
            )}
            {(watchlistLoading || valuesLoading) && (
              <Spinner animation="border" size="sm" style={{ marginLeft: 8 }} />
            )}
          </PageTitle>
        </Col>
        <Col className="d-flex justify-content-center">
          <TabsContainer>
            {DASHBOARD_TABS.map((tab) => (
              <Link key={tab.path} href={tab.path} passHref legacyBehavior>
                <TabLink isActive={router.pathname === tab.path}>
                  {tab.label}
                </TabLink>
              </Link>
            ))}
          </TabsContainer>
        </Col>
        <Col xs="auto" />
      </Row>
      <Row className="mb-3">
        <Col data-tour="dashboard-toolbar">
          <MarketDashboardToolbar
            config={config}
            panelsVisible={panelsVisible}
            onTogglePanels={() => setPanelsVisible((v) => !v)}
            uniqueEntidades={uniqueEntidades}
            uniqueTiposFondo={uniqueTiposFondo}
            uniqueClasesActivo={uniqueClasesActivo}
          />
        </Col>
      </Row>
      <Row>
        {panelsVisible && (
          <Col sm={3} data-tour="watchlist-left">
            <WatchlistPanel
              groups={left}
              selectedTickers={selectedTickers}
              chartColorMap={chartColorMap}
              onRowClick={handleRowClick}
              ficHierarchical={config.ficHierarchical}
              ficFunds={ficFunds}
              onCompareFund={handleCompareFund}
            />
          </Col>
        )}
        <Col sm={panelsVisible ? 6 : 12} data-tour="chart-area">
          <PerformanceChart />
        </Col>
        {panelsVisible && (
          <Col sm={3}>
            <WatchlistPanel
              groups={right}
              selectedTickers={selectedTickers}
              chartColorMap={chartColorMap}
              onRowClick={handleRowClick}
              ficHierarchical={config.ficHierarchical}
              ficFunds={ficFunds}
              onCompareFund={handleCompareFund}
            />
          </Col>
        )}
      </Row>
    </Container>
  );
}
