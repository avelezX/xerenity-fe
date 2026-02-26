import React from 'react';
import Chart from '@components/chart/Chart';
import useAppStore from 'src/store';

const NORMALIZE_SCALE = 'normalized';

export default function PerformanceChart() {
  const chartSelections = useAppStore((s) => s.chartSelections);
  const normalizeChart = useAppStore((s) => s.normalizeChart);
  const normalizeDate = useAppStore((s) => s.normalizeDate);
  const chartLoading = useAppStore((s) => s.chartLoading);

  const applyFunctions = normalizeChart ? ['normalize'] : undefined;

  return (
    <Chart chartHeight="calc(100vh - 220px)" showToolbar loading={chartLoading}>
      {chartSelections.map((selection) => (
        <Chart.Line
          key={selection.ticker}
          data={selection.data}
          color={selection.color}
          title={selection.display_name}
          scaleId={normalizeChart ? NORMALIZE_SCALE : undefined}
          applyFunctions={applyFunctions}
          fromNormalizeDate={normalizeDate || undefined}
        />
      ))}
    </Chart>
  );
}
