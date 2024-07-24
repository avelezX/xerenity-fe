import React, { useEffect, useRef } from 'react';

import normalizeSeries from '@components/chart/functions/normalize';
import { LightSerieValue, defaultCustomFormat } from 'src/types/lightserie';
import { ISeriesApi } from 'lightweight-charts';

import { TimeValueSerie } from '../../Models';
import { useChartContext } from '../../ChartContext';

/*
    Documentation can be found
    https://tradingview.github.io/lightweight-charts/docs/series-types#line
*/

function LineSerie({
  data,
  color,
  title,
  children,
  scaleId,
  applyFunctions,
}: TimeValueSerie) {
  const chartContext = useChartContext();

  const thisChart = useRef<ISeriesApi<'Line'> | null>(null);

  useEffect(() => {
    if (chartContext) {
      if (thisChart.current) {
        thisChart.current.applyOptions({
          color,
          priceFormat: defaultCustomFormat,
          priceScaleId: scaleId || title,
        });
      } else {
        const serie = chartContext.chart.addLineSeries({
          color,
          priceFormat: defaultCustomFormat,
          priceScaleId: scaleId || title,
        });
        thisChart.current = serie;
      }
      if (data) {
        let newData: LightSerieValue[] = data;

        if (applyFunctions) {
          applyFunctions.forEach((funcName) => {
            switch (funcName) {
              case 'normalize':
                newData = normalizeSeries(data);
                break;
              default:
                break;
            }
          });
        }

        thisChart.current.setData(newData);
      }
      if (chartContext !== undefined) {
        chartContext.chart.timeScale().fitContent();
      }
      chartContext.listSeriesName(title, color);
    }
  });

  useEffect(
    () => () => {
      if (thisChart.current) {
        if (chartContext && chartContext.chart) {
          chartContext.chart.removeSeries(thisChart.current);
          chartContext.removelistSeriesName(title);
        }
      }
    },
    [chartContext, title]
  );

  return <div>{children}</div>;
}

export default LineSerie;
