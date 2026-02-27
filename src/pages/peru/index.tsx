'use client';

import { CoreLayout } from '@layout';
import { faGlobeAmericas } from '@fortawesome/free-solid-svg-icons';
import MarketDashboard from '@components/marketDashboard/MarketDashboard';
import { DashboardConfig } from 'src/types/watchlist';

const PERU_CONFIG: DashboardConfig = {
  title: 'Peru - BCRP',
  icon: faGlobeAmericas,
  filters: {
    fuentes: ['BCRP'],
  },
  groupByField: 'sub_group',
  defaultPeriod: '1Y',
  showNormalize: true,
};

export default function PeruPage() {
  return (
    <CoreLayout>
      <MarketDashboard config={PERU_CONFIG} />
    </CoreLayout>
  );
}
