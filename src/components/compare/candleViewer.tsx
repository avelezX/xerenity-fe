import Container from 'react-bootstrap/Container';
import { CandleSerie } from '@models/tes';
import {
  CandlestickData,
  HistogramData,
  Time,
  WhitespaceData,
  createChart,
  IChartApi,
  CrosshairMode,
} from 'lightweight-charts';
import React, { useEffect, useRef } from 'react';
import { Card } from 'react-bootstrap';
import { LightSerie, defaultCustomFormat } from '@models/lightserie';
import normalizeSeries from './normalize';

type ViewerProps = {
  candleSerie: CandleSerie | null;
  otherSeries: LightSerie[] | null;
  fit: boolean;
  normalyze: boolean;
  shorten: boolean;
  chartHeight: string;
  watermarkText: 'Xerenity' | '';
};

export default function CandleSerieViewer({
  candleSerie,
  otherSeries,
  fit,
  normalyze,
  shorten,
  chartHeight,
  watermarkText,
}: ViewerProps) {
  const chartContainerRef = useRef<HTMLInputElement | null>(null);
  const chart = useRef<IChartApi | null>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    let newSeries = Array<LightSerie>();
    if (chartContainerRef.current) {
      chartContainerRef.current.innerHTML = '';

      const element = document.createElement('div');

      const chartOptions = {
        width: chartContainerRef.current.offsetWidth,
        height: chartContainerRef.current.offsetHeight,
        type: 'solid',
        color: 'transparent',
        autoSize: true,
        layout: {
          background: {
            color: 'transparent',
          },
          textColor: '#D3D3D3',
        },
        watermark: {
          visible: true,
          fontSize: 100,
          color: '#D3D3D3',
          text: watermarkText,
        },
        grid: {
          vertLines: {
            color: '#D3D3D3',
          },
          horzLines: {
            color: '#D3D3D3',
          },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
        },
        priceScale: {
          borderColor: '#485c7b',
        },
        timeScale: {
          borderColor: '#485c7b',
          fixLeftEdge: true,
          uniformDistribution: true,
          visible: true,
        },
      };

      chart.current = createChart(chartContainerRef.current, chartOptions);

      if (chart.current) {
        const legend = document.createElement('div');
        legend.setAttribute(
          'style',
          `position: absolute; left: 20px; top: 12px; z-index: 1; font-size: 14px; font-family: sans-serif; line-height: 20px; font-weight: 300;`
        );
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
              color: '#2270E2',
              priceFormat: {
                type: 'volume',
              },
              priceScaleId: 'volume',
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

            /*
                chart.current.subscribeCrosshairMove((handler)=>{
                  if(handler.hoveredSeries===candlestickSeries){
                    console.log(handler)
                  }
                })
              */

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

            if (normalyze) {
              scaleid = 'right';
            } else if (index > 0) {
              scaleid = other.name;
            } else {
              scaleid = 'right';
            }

            if (other.type === 'bar') {
              const otherSerieChart = chart.current?.addHistogramSeries({
                color: other.color,
                priceScaleId: scaleid,
                priceFormat: other.priceFormat,
                title: other.name,
              });

              if (otherSerieChart) {
                otherSerieChart.setData(other.serie);
              }
            } else {
              const otherSerieChart = chart.current?.addLineSeries({
                color: other.color,
                priceScaleId: scaleid,
                priceFormat: defaultCustomFormat,
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
