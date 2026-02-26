'use client';

import { CoreLayout } from '@layout';
import { faDollarSign } from '@fortawesome/free-solid-svg-icons';
import MarketDashboard from '@components/marketDashboard/MarketDashboard';
import { DashboardConfig } from 'src/types/watchlist';

const MONEDAS_CONFIG: DashboardConfig = {
  title: 'Monedas',
  icon: faDollarSign,
  filters: {
    grupos: ['Divisas'],
  },
  groupByField: 'sub_group',
  defaultPeriod: '3M',
  showNormalize: true,
};

export default function MonedasDashboardPage() {
  return (
    <CoreLayout>
      <MarketDashboard config={MONEDAS_CONFIG} />
    </CoreLayout>
  );
}
