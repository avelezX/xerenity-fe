import Container from 'react-bootstrap/Container';
import { CandleSerie } from 'src/types/tes';
import {
  CandlestickData,
  HistogramData,
  Time,
  WhitespaceData,
  createChart,
  IChartApi,
} from 'lightweight-charts';
import React, { useEffect, useRef } from 'react';
import { Card } from 'react-bootstrap';
import { LightSerie, defaultCustomFormat } from 'src/types/lightserie';
import tokens from 'design-tokens/tokens.json';
import normalizeSeries from './normalize';
import charOptions, { legendStyles } from './candleViewerOptions';

type ViewerProps = {
  candleSerie?: CandleSerie | null;
  otherSeries: LightSerie[] | null;
  fit: boolean;
  normalyze?: boolean;
  shorten: boolean;
  chartHeight: string;
};

const designSystem = tokens.xerenity;
const GREY_COLOR_300 = designSystem['gray-300'].value;

export default function CandleSerieViewer({
  candleSerie,
  otherSeries,
  fit,
  normalyze = false,
  shorten,
  chartHeight,
}: ViewerProps) {
  const chartContainerRef = useRef<HTMLInputElement | null>(null);
  const chart = useRef<IChartApi | null>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    let newSeries = Array<LightSerie>();
    if (chartContainerRef.current) {
      chartContainerRef.current.innerHTML = '';

      const element = document.createElement('div');
      charOptions.width = chartContainerRef.current.offsetWidth;
      charOptions.height = chartContainerRef.current.offsetHeight;
      chart.current = createChart(chartContainerRef.current, charOptions);

      if (chart.current) {
        const legend = document.createElement('div');
        legend.setAttribute('style', legendStyles);
        chartContainerRef.current.appendChild(legend);

        const firstRow = document.createElement('div');

        let iner: string = '<dl id="serieList">';

        if (candleSerie) {
          if (candleSerie.values.length > 0) {
            const serieData:
              | (WhitespaceData<Time> | CandlestickData<Time>)[]
              | {
                  time: string;
                  open: number;
                  high: number;
                  low: number;
                  close: number;
                }[] = [];
            const volData:
              | (WhitespaceData<Time> | HistogramData<Time>)[]
              | { time: string; value: number }[] = [];

            if (candleSerie.name) {
              iner = `<dd style="color:#2270E2"><h6>${candleSerie.name}</h6></dd> ${iner}`;
            }

            candleSerie.values.forEach((tes) => {
              serieData.push({
                time: tes.day.split('T')[0],
                open: tes.open,
                high: tes.high,
                low: tes.low,
                close: tes.close,
              });

              volData.push({
                time: tes.day.split('T')[0],
                value: tes.volume,
              });
            });

            const volumeSeries = chart.current.addHistogramSeries({
              color: GREY_COLOR_300,
              priceFormat: {
                type: 'volume',
              },
              priceScaleId: 'left',
              title: 'volume',
            });

            volumeSeries.priceScale().applyOptions({
              // set the positioning of the volume series
              scaleMargins: {
                top: 0.9, // highest point of the series will be 70% away from the top
                bottom: 0.0,
              },
            });

            const candlestickSeries = chart.current.addCandlestickSeries({
              upColor: '#26a69a',
              downColor: '#ef5350',
              borderVisible: true,
              wickUpColor: '#26a69a',
              wickDownColor: '#ef5350',
              priceScaleId: 'right',
            });

            candlestickSeries.setData(serieData);

            volumeSeries.setData(volData);
          }
        }

        if (otherSeries) {
          newSeries = normalizeSeries(otherSeries, normalyze, shorten);

          newSeries.forEach((other, index) => {
            if (other.name) {
              iner = `<dd style="color:${other.color}"><h6>${other.name}</h6></dd> ${iner}`;
            }

            let scaleid = 'right';

            if (other.axisName) {
              scaleid = other.axisName;
            } else if (index === 0) {
              scaleid = 'left';
            } else if (index === 1) {
              scaleid = 'right';
            } else {
              scaleid = other.name;
            }

            if (other.type === 'bar') {
              const otherSerieChart = chart.current?.addHistogramSeries({
                color: other.color,
                priceFormat: other.priceFormat,
                priceScaleId: scaleid,
                title: other.name,
              });

              if (otherSerieChart) {
                otherSerieChart.setData(other.serie);
              }
            } else {
              const otherSerieChart = chart.current?.addLineSeries({
                color: other.color,
                priceFormat: defaultCustomFormat,
                priceScaleId: scaleid,
                title: other.name,
              });

              if (otherSerieChart) {
                otherSerieChart.setData(other.serie);
              }
            }
          });
        }

        firstRow.innerHTML = `${iner}</dl>`;
        legend.appendChild(firstRow);

        if (fit) {
          chart.current.timeScale().fitContent();
        }
      }

      chartContainerRef.current.appendChild(element);
    }
  });

  useEffect(() => {
    resizeObserver.current = new ResizeObserver((entries) => {
      if (entries.length === 0) {
        return;
      }
      if (chart.current) {
        const newRect = entries[0].contentRect;
        chart.current.applyOptions({
          height: newRect.height,
          width: newRect.width,
        });
      }
      setTimeout(() => {
        if (chart.current) {
          chart.current.timeScale().fitContent();
        }
      }, 0);
    });

    if (chartContainerRef.current) {
      resizeObserver.current.observe(chartContainerRef.current);
    }

    return () => resizeObserver.current?.disconnect();
  }, []);

  return (
    <Card style={{ width: '100%', height: '100%' }}>
      <Card.Body style={{ width: '100%', height: chartHeight }}>
        <Container
          ref={chartContainerRef}
          className="chart-container"
          style={{ width: '100%', height: '100%' }}
        />
      </Card.Body>
    </Card>
  );
}
