'use client';

import { CoreLayout } from '@layout';
import { faLineChart } from '@fortawesome/free-solid-svg-icons';
import MarketDashboard from '@components/marketDashboard/MarketDashboard';
import { DashboardConfig } from 'src/types/watchlist';

const TASAS_CONFIG: DashboardConfig = {
  title: 'Tasas de Interés',
  icon: faLineChart,
  filters: {
    grupos: [
      'IBR-SWAP',
      'COLTES',
      'Tasas de Interés',
      'Tasas Implícitas',
      'Tasas de Captación',
      'Tasa de Usura',
      'Política Monetaria',
    ],
  },
  groupByField: 'sub_group',
  defaultPeriod: '1Y',
  showNormalize: true,
};

export default function TasasPage() {
  return (
    <CoreLayout>
      <MarketDashboard config={TASAS_CONFIG} />
    </CoreLayout>
  );
}
