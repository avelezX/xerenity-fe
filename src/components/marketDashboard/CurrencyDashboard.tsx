import React, { useState, useCallback } from 'react';
import { Container, Row, Col, Spinner, InputGroup } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDollarSign } from '@fortawesome/free-solid-svg-icons';
import { useRouter } from 'next/router';
import Link from 'next/link';
import PageTitle from '@components/PageTitle';
import Toolbar from '@components/UI/Toolbar';
import useAppStore from 'src/store';
import CurrencyPanel from './CurrencyPanel';
import PerformanceChart from './PerformanceChart';
import TimePeriodSelector from './TimePeriodSelector';
import { TabsContainer, TabLink } from './styled/DashboardTabs.styled';

const DASHBOARD_TABS = [
  { label: 'BanRep', path: '/suameca' },
  { label: 'Tasas', path: '/tasas' },
  { label: 'Monedas', path: '/monedas-dashboard' },
  { label: 'FIC', path: '/fic' },
  { label: 'Par de Monedas', path: '/par-monedas' },
];

export default function CurrencyDashboard() {
  const router = useRouter();
  const chartLoading = useAppStore((s) => s.chartLoading);
  const chartPeriod = useAppStore((s) => s.chartPeriod);
  const setChartPeriod = useAppStore((s) => s.setChartPeriod);
  const normalizeChart = useAppStore((s) => s.normalizeChart);
  const setNormalizeChart = useAppStore((s) => s.setNormalizeChart);
  const chartSelections = useAppStore((s) => s.chartSelections);
  const clearChart = useAppStore((s) => s.clearChart);
  const addCurrencyPairToChart = useAppStore((s) => s.addCurrencyPairToChart);

  const [selectedFrom, setSelectedFrom] = useState<string | null>(null);
  const [selectedTo, setSelectedTo] = useState<string | null>(null);

  const handleFromSelect = useCallback(
    (currency: string) => {
      setSelectedFrom(currency);
      if (selectedTo && currency !== selectedTo) {
        addCurrencyPairToChart(`${currency}:${selectedTo}`);
      }
    },
    [selectedTo, addCurrencyPairToChart]
  );

  const handleToSelect = useCallback(
    (currency: string) => {
      setSelectedTo(currency);
      if (selectedFrom && selectedFrom !== currency) {
        addCurrencyPairToChart(`${selectedFrom}:${currency}`);
      }
    },
    [selectedFrom, addCurrencyPairToChart]
  );

  return (
    <Container fluid className="px-4">
      <Row className="align-items-center justify-content-between">
        <Col xs="auto">
          <PageTitle>
            <FontAwesomeIcon icon={faDollarSign} />
            <h4>Par de Monedas</h4>
            {chartLoading && (
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
        <Col>
          <Toolbar>
            <TimePeriodSelector activePeriod={chartPeriod} onChange={setChartPeriod} />
            <InputGroup style={{ width: 'auto' }}>
              <InputGroup.Checkbox
                checked={normalizeChart}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNormalizeChart(e.target.checked)
                }
              />
              <InputGroup.Text style={{ fontSize: 12 }}>
                Normalizar
              </InputGroup.Text>
            </InputGroup>
            {chartSelections.length > 0 && (
              <button
                type="button"
                onClick={clearChart}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: 12,
                  color: '#999',
                  cursor: 'pointer',
                }}
              >
                Limpiar chart
              </button>
            )}
          </Toolbar>
        </Col>
      </Row>
      <Row>
        <Col sm={2}>
          <CurrencyPanel
            title="De (FROM)"
            selected={selectedFrom}
            onSelect={handleFromSelect}
          />
        </Col>
        <Col sm={8}>
          <PerformanceChart />
        </Col>
        <Col sm={2}>
          <CurrencyPanel
            title="A (TO)"
            selected={selectedTo}
            onSelect={handleToSelect}
          />
        </Col>
      </Row>
    </Container>
  );
}
