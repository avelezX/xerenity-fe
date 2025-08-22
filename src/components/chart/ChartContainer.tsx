import { IChartApi, Time, createChart } from 'lightweight-charts';
import React, { useRef, PropsWithChildren, useEffect } from 'react';
import Panel from '@components/Panel';
import charOptions from './ChartOptions';
import { ChartContext } from './ChartContext';
import ChartToolBar from './ChartToolbar';

type ChartProps = {
  chartHeight?: number | string;
  showToolbar?: boolean | undefined;
  loading?: boolean;
} & PropsWithChildren;

const DEFAULT_CHART_HEIGHT = 400;

// Define a custom time formatter function
const customTimeFormatter = (time: Time) => `${time}`; // Custom date format YYYY-MM-DD

export default function ChartContainer({
  children,
  chartHeight,
  showToolbar,
  loading,
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

  const downloadChartsPng = () => {
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
  };

  const swapDateFormater = () => {
    if (chart.current) {
      chart.current.applyOptions({
        timeScale: {
          tickMarkFormatter: customTimeFormatter,
        },
      });
    }
  };

  const resetZoom = () => {
    if (chart.current) {
      chart.current.timeScale().fitContent();
    }
  };

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

  return (
    <Panel>
      {showToolbar && (
        <ChartToolBar
          onDateAction={swapDateFormater}
          onZoomAction={resetZoom}
          onScreenshot={downloadChartsPng}
          loading={loading || false}
        />
      )}
      <div
        ref={chartContainerRef}
        style={{ height: chartHeight || DEFAULT_CHART_HEIGHT }}
      >
        <ChartContext.Provider value={chart.current}>
          {children}
        </ChartContext.Provider>
      </div>
    </Panel>
  );
}
