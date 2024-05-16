import React, { useEffect, useRef } from 'react';
import { defaultCustomFormat } from 'src/types/lightserie';
import {
  ISeriesApi,
  WhitespaceData,
  CandlestickData,
  Time,
} from 'lightweight-charts';

import { CandleSerieProps } from '../../Models';
import { useChartContext } from '../../ChartContext';

/*
    Documentation can be found
    https://tradingview.github.io/lightweight-charts/docs/series-types#candlestick

*/
function CandleSerie({ data, title, children, scaleId }: CandleSerieProps) {
  const chartContext = useChartContext();

  const thisChart = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const serieData:
    | (WhitespaceData<Time> | CandlestickData<Time>)[]
    | {
        time: string;
        open: number;
        high: number;
        low: number;
        close: number;
      }[] = [];

  useEffect(() => {
    if (chartContext) {
      if (thisChart.current) {
        thisChart.current.applyOptions({
          priceFormat: defaultCustomFormat,
          priceScaleId: scaleId || title,
          title,
        });
      } else {
        const serie = chartContext.addCandlestickSeries({
          priceFormat: defaultCustomFormat,
          priceScaleId: scaleId || title,
          title,
        });
        thisChart.current = serie;
      }

      data.forEach((tes) => {
        serieData.push({
          time: tes.day.split('T')[0],
          open: tes.open,
          high: tes.high,
          low: tes.low,
          close: tes.close,
        });
      });

      if (serieData) {
        thisChart.current.setData(serieData);
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

export default CandleSerie;
