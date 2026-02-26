import React, { useState } from 'react';
import { InputGroup, Form } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExpand, faCompress, faPlus } from '@fortawesome/free-solid-svg-icons';
import useAppStore from 'src/store';
import { DashboardConfig } from 'src/types/watchlist';
import Toolbar from '@components/UI/Toolbar';
import TimePeriodSelector from './TimePeriodSelector';
import CurrencyPairModal from './CurrencyPairModal';

type MarketDashboardToolbarProps = {
  config: DashboardConfig;
  panelsVisible: boolean;
  onTogglePanels: () => void;
};

export default function MarketDashboardToolbar({
  config,
  panelsVisible,
  onTogglePanels,
}: MarketDashboardToolbarProps) {
  const chartPeriod = useAppStore((s) => s.chartPeriod);
  const setChartPeriod = useAppStore((s) => s.setChartPeriod);
  const normalizeChart = useAppStore((s) => s.normalizeChart);
  const setNormalizeChart = useAppStore((s) => s.setNormalizeChart);
  const setMarketSearchText = useAppStore((s) => s.setMarketSearchText);
  const chartSelections = useAppStore((s) => s.chartSelections);
  const clearChart = useAppStore((s) => s.clearChart);
  const addCurrencyPairToChart = useAppStore((s) => s.addCurrencyPairToChart);

  const [showCurrencyModal, setShowCurrencyModal] = useState(false);

  const handleCurrencyPairSave = (pair: string) => {
    addCurrencyPairToChart(pair);
    setShowCurrencyModal(false);
  };

  return (
    <>
      <Toolbar>
        <TimePeriodSelector activePeriod={chartPeriod} onChange={setChartPeriod} />
        {config.showCurrencyPairSelector && (
          <button
            type="button"
            onClick={() => setShowCurrencyModal(true)}
            style={{
              border: '1px solid #7c5cbf',
              background: 'transparent',
              fontSize: 12,
              color: '#7c5cbf',
              cursor: 'pointer',
              borderRadius: 4,
              padding: '4px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <FontAwesomeIcon icon={faPlus} size="xs" />
            Par de monedas
          </button>
        )}
        {config.showNormalize && (
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
        )}
        <Form.Control
          type="text"
          placeholder="Buscar serie..."
          size="sm"
          style={{ maxWidth: 200, fontSize: 12 }}
          onChange={(e) => setMarketSearchText(e.target.value)}
        />
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
        <button
          type="button"
          onClick={onTogglePanels}
          title={panelsVisible ? 'Expandir chart' : 'Mostrar paneles'}
          style={{
            border: 'none',
            background: 'transparent',
            fontSize: 14,
            color: '#999',
            cursor: 'pointer',
            marginLeft: 'auto',
          }}
        >
          <FontAwesomeIcon icon={panelsVisible ? faExpand : faCompress} />
        </button>
      </Toolbar>
      {config.showCurrencyPairSelector && (
        <CurrencyPairModal
          show={showCurrencyModal}
          onCancel={() => setShowCurrencyModal(false)}
          onSave={handleCurrencyPairSave}
        />
      )}
    </>
  );
}
