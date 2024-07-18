import { IChartApi, Time, createChart } from 'lightweight-charts';
import React, { useRef, PropsWithChildren, useEffect } from 'react';
import { Card, Container } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faCalendar,
  faImage,
  faMagnifyingGlassMinus,
} from '@fortawesome/free-solid-svg-icons';
import IconButton from '@components/UI/IconButton';
import charOptions from './ChartOptions';
import { ChartContext } from './ChartContext';

type ChartProps = {
  chartHeight: number | string;
  showToolbar?: boolean | undefined;
} & PropsWithChildren;

// Define a custom time formatter function
const customTimeFormatter = (time: Time) => `${time}`; // Custom date format YYYY-MM-DD
export default function ChartContainer({
  children,
  chartHeight,
  showToolbar,
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

  function downloadChartsPng() {
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
  }

  function swapDateFormater() {
    if (chart.current) {
      chart.current.applyOptions({
        timeScale: {
          tickMarkFormatter: customTimeFormatter,
        },
      });
    }
  }

  function resetZoom() {
    if (chart.current) {
      chart.current.timeScale().fitContent();
    }
  }

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
      {showToolbar && (
        <Card.Footer>
          <div className="w-100 h-100 d-flex gap-3 justify-content-end">
            <IconButton onClick={() => swapDateFormater()}>
              <Icon icon={faCalendar} />
            </IconButton>
            <IconButton onClick={() => resetZoom()}>
              <Icon icon={faMagnifyingGlassMinus} />
            </IconButton>
            <IconButton onClick={() => downloadChartsPng()}>
              <Icon icon={faImage} />
            </IconButton>
          </div>
        </Card.Footer>
      )}
    </Card>
  );
}
