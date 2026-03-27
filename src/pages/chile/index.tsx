'use client';

import { CoreLayout } from '@layout';
import { faGlobeAmericas } from '@fortawesome/free-solid-svg-icons';
import MarketDashboard from '@components/marketDashboard/MarketDashboard';
import { DashboardConfig } from 'src/types/watchlist';

const CHILE_CONFIG: DashboardConfig = {
  title: 'Chile - BCCh',
  icon: faGlobeAmericas,
  filters: {
    fuentes: ['BCCh'],
  },
  groupByField: 'sub_group',
  defaultPeriod: '1Y',
  showNormalize: true,
};

export default function ChilePage() {
  return (
    <CoreLayout>
      <MarketDashboard config={CHILE_CONFIG} />
    </CoreLayout>
  );
}
