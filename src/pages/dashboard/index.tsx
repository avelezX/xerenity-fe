import { CoreLayout } from '@layout';
import type { NextPage } from 'next';
import SeriesViewer from '@components/banrep/SerieViwers';

const Dashboard: NextPage = () => (
  <CoreLayout>
    <SeriesViewer />
  </CoreLayout>
);

export default Dashboard;
