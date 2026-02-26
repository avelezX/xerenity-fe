import React from 'react';
import Chart from '@components/chart/Chart';
import useAppStore from 'src/store';
import {
  LegendContainer,
  LegendItem,
  LegendColor,
} from './styled/ChartLegend.styled';

const NORMALIZE_SCALE = 'normalized';

export default function PerformanceChart() {
  const chartSelections = useAppStore((s) => s.chartSelections);
  const normalizeChart = useAppStore((s) => s.normalizeChart);
  const normalizeDate = useAppStore((s) => s.normalizeDate);
  const chartLoading = useAppStore((s) => s.chartLoading);
  const removeFromChart = useAppStore((s) => s.removeFromChart);

  const applyFunctions = normalizeChart ? ['normalize'] : undefined;

  return (
    <>
      <LegendContainer>
        {chartSelections.map((s) => (
          <LegendItem
            key={s.ticker}
            title={`Click para quitar ${s.display_name}`}
            onClick={() => removeFromChart(s.ticker)}
          >
            <LegendColor color={s.color} />
            {s.display_name}
          </LegendItem>
        ))}
      </LegendContainer>
      <Chart chartHeight="calc(100vh - 245px)" showToolbar loading={chartLoading}>
        {chartSelections.map((selection) => (
          <Chart.Line
            key={selection.ticker}
            data={selection.data}
            color={selection.color}
            title=""
            scaleId={normalizeChart ? NORMALIZE_SCALE : 'right'}
            applyFunctions={applyFunctions}
            fromNormalizeDate={normalizeDate || undefined}
            lastValueVisible={false}
            priceLineVisible={false}
          />
        ))}
      </Chart>
    </>
  );
}
