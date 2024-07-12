import {
  IChartApi,
  MouseEventParams,
  SeriesMarker,
  Time,
  createChart,
} from 'lightweight-charts';
import tokens from 'design-tokens/tokens.json';
import React, { useRef, PropsWithChildren, useEffect } from 'react';
import { Card, Container } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faImage } from '@fortawesome/free-solid-svg-icons';
import IconButton from '@components/UI/IconButton';
import charOptions from './ChartOptions';
import { ChartContext } from './ChartContext';

const designSystem = tokens.xerenity;
const PURPLE_COLOR_100 = designSystem['purple-100'].value;

type ChartProps = {
  chartHeight: number | string;
  showToolbar?: boolean | undefined;
} & PropsWithChildren;

const marker: SeriesMarker<Time> = {
  time: '',
  position: 'aboveBar',
  color: PURPLE_COLOR_100,
  shape: 'arrowDown',
  text: 'X',
  size: 1,
};

export default function ChartContainer({
  children,
  chartHeight,
  showToolbar,
}: ChartProps) {
  const chart = useRef<IChartApi>();
  const chartContainerRef = useRef<HTMLInputElement | null>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const timeoutId = useRef<NodeJS.Timeout>();

  function myDblClickHandler(param: MouseEventParams) {
    if (param.seriesData.size > 0) {
      if (param.time) {
        marker.time = param.time;
        param.seriesData.forEach((key, value) => {
          if (key.time === param.time) {
            const allMarkers = value.markers();
            allMarkers.push(marker);
            allMarkers.sort(
              (a, b) =>
                new Date(a.time.toString()).getTime() -
                new Date(b.time.toString()).getTime()
            );
            value.setMarkers(allMarkers);
          }
        });
      }
    }
  }

  useEffect(() => {
    if (chartContainerRef.current) {
      chartContainerRef.current.innerHTML = '';
      charOptions.width = chartContainerRef.current.offsetWidth;
      charOptions.height = chartContainerRef.current.offsetHeight;
      chart.current = createChart(chartContainerRef.current, charOptions);
      chart.current.timeScale().fitContent();

      chart.current.subscribeDblClick(myDblClickHandler);
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
          <div className="w-100 h-100 d-flex justify-content-end">
            <IconButton onClick={() => downloadChartsPng()}>
              <Icon icon={faImage} />
            </IconButton>
          </div>
        </Card.Footer>
      )}
    </Card>
  );
}
