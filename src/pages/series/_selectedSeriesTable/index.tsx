import BaseDataTable from '@components/Table/BaseDataTable';
import { LightSerie } from 'src/types/lightserie';

import SelectedSerieListColumns from '@components/Table/columnDefinition/series/seectedColumns';

type LoanListProps = {
  list: LightSerie[];
};

const EmptyState = () => (
  <div
    className="d-flex flex-column align-items-center justify-content-center text-muted"
    style={{ minHeight: '200px', gap: '8px' }}
  >
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: 0.4 }}
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
    <span className="small">Selecciona series de la tabla</span>
  </div>
);

const SelectedSeriesTable = ({ list }: LoanListProps) => {
  if (list.length === 0) {
    return <EmptyState />;
  }
  return (
    <BaseDataTable columns={SelectedSerieListColumns} data={list} fixedHeader />
  );
};

export default SelectedSeriesTable;
