'use client';

import { CoreLayout } from '@layout';
import CurrencyDashboard from '@components/marketDashboard/CurrencyDashboard';

export default function ParMonedasPage() {
  return (
    <CoreLayout>
      <CurrencyDashboard />
    </CoreLayout>
  );
}
