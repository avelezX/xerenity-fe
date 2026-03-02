'use client';

import { CoreLayout } from '@layout';
import { faChartSimple } from '@fortawesome/free-solid-svg-icons';
import MarketDashboard from '@components/marketDashboard/MarketDashboard';
import { DashboardConfig } from 'src/types/watchlist';

const FIC_CONFIG: DashboardConfig = {
  title: 'Fondos de Inversión Colectiva',
  icon: faChartSimple,
  filters: {
    grupos: ['FIC'],
  },
  groupByField: 'sub_group',
  defaultPeriod: '1Y',
  showNormalize: true,
  showEntidadFilter: true,
  showActivoFilter: true,
  showTipoFondoFilter: true,
  infoPath: '/fic/info',
  ficHierarchical: true,
};

export default function FICPage() {
  return (
    <CoreLayout>
      <MarketDashboard config={FIC_CONFIG} />
    </CoreLayout>
  );
}
