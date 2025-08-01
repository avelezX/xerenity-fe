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
  fromNormalizeDate,
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
          title,
        });
      } else {
        const serie = chartContext.addLineSeries({
          color,
          priceFormat: defaultCustomFormat,
          priceScaleId: scaleId || title,
          title,
        });
        thisChart.current = serie;
      }
      if (data) {
        let newData: LightSerieValue[] = data;

        if (applyFunctions) {
          applyFunctions.forEach((funcName) => {
            switch (funcName) {
              case 'normalize':
                newData = normalizeSeries({
                  existingSeries: data,
                  fromNormalizeDate,
                });
                break;
              default:
                break;
            }
          });
        }

        thisChart.current.setData(newData);
      }
      if (chartContext !== undefined) {
        chartContext.timeScale().fitContent();
      }
    }
  });

  useEffect(
    () => () => {
      if (thisChart.current) {
        if (chartContext) {
          chartContext.removeSeries(thisChart.current);
        }
      }
    },
    [chartContext]
  );

  return <div>{children}</div>;
}

export default LineSerie;
