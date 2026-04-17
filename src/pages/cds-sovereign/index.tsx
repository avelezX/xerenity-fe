'use client';

import { CoreLayout } from '@layout';
import { faGlobe } from '@fortawesome/free-solid-svg-icons';
import MarketDashboard from '@components/marketDashboard/MarketDashboard';
import { DashboardConfig } from 'src/types/watchlist';

const CDS_SOVEREIGN_CONFIG: DashboardConfig = {
  title: 'CDS Sovereign 5Y',
  icon: faGlobe,
  filters: {
    grupos: ['CDS Sovereign'],
  },
  groupByField: 'sub_group',
  defaultPeriod: '1Y',
  showNormalize: true,
};

export default function CDSSovereignPage() {
  return (
    <CoreLayout>
      <MarketDashboard config={CDS_SOVEREIGN_CONFIG} />
    </CoreLayout>
  );
}
