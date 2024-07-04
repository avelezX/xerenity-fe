import { IChartApi, createChart } from 'lightweight-charts';
import React, { useRef, PropsWithChildren, useEffect } from 'react';
import { Card, Container } from 'react-bootstrap';

import charOptions from './ChartOptions';
import { ChartContext } from './ChartContext';

type ChartProps = {
  chartHeight: number | string;
  noCard?: boolean;
  screenShot?: boolean;
} & PropsWithChildren;

export default function ChartContainer({
  children,
  chartHeight,
  noCard,
  screenShot,
}: ChartProps) {
  const chart = useRef<IChartApi>();
  const chartContainerRef = useRef<HTMLInputElement | null>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const timeoutId = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (chartContainerRef.current) {
      chartContainerRef.current.innerHTML = '';
      charOptions.width = chartContainerRef.current.offsetWidth;
      charOptions.height = chartContainerRef.current.offsetHeight;
      chart.current = createChart(chartContainerRef.current, charOptions);
      chart.current.timeScale().fitContent();
    }
  }, []);

  useEffect(() => {
    if (chart.current) {
      const screenshot = chart.current.takeScreenshot();

      screenshot.toBlob((blob) => {
        if (blob) {
          const newImg = document.createElement('img');
          const url = URL.createObjectURL(blob);

          newImg.onload = () => {
            URL.revokeObjectURL(url);
          };

          newImg.src = url;
          const pom = document.createElement('a');
          pom.href = url;
          pom.setAttribute('download', 'xerenity_series.png');
          pom.click();
        }
      });
    }
  }, [screenShot]);

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
      timeoutId.current = setTimeout(() => {
        if (chart.current) {
          chart.current.timeScale().fitContent();
        }
      }, 0);
    });

    if (chartContainerRef.current) {
      resizeObserver.current.observe(chartContainerRef.current);
    }

    return () => {
      resizeObserver.current?.disconnect();
      clearTimeout(timeoutId.current);
    };
  });

  return noCard ? (
    <div style={{ width: '100%', height: chartHeight }} ref={chartContainerRef}>
      <ChartContext.Provider value={chart.current}>
        {children}
      </ChartContext.Provider>
    </div>
  ) : (
    <Card style={{ width: '100%', height: '100%' }}>
      <Card.Body style={{ width: '100%', height: chartHeight }}>
        <Container
          style={{ width: '100%', height: '100%' }}
          ref={chartContainerRef}
          className="chart-container"
        >
          <ChartContext.Provider value={chart.current}>
            {children}
          </ChartContext.Provider>
        </Container>
      </Card.Body>
    </Card>
  );
}
