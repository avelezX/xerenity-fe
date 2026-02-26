'use client';

import { CoreLayout } from '@layout';
import { faLandmark } from '@fortawesome/free-solid-svg-icons';
import MarketDashboard from '@components/marketDashboard/MarketDashboard';
import { DashboardConfig } from 'src/types/watchlist';

const SUAMECA_CONFIG: DashboardConfig = {
  title: 'SUAMECA - BanRep',
  icon: faLandmark,
  filters: {
    fuentes: ['BanRep'],
  },
  groupByField: 'sub_group',
  defaultPeriod: '1Y',
  showNormalize: true,
};

export default function SUAMECAPage() {
  return (
    <CoreLayout>
      <MarketDashboard config={SUAMECA_CONFIG} />
    </CoreLayout>
  );
}
