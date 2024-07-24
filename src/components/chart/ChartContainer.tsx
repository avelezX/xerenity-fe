import { Time, createChart } from 'lightweight-charts';
import React, {
  useRef,
  PropsWithChildren,
  useEffect,
  useCallback,
} from 'react';
import { Card, Container } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faCalendar,
  faImage,
  faMagnifyingGlassMinus,
} from '@fortawesome/free-solid-svg-icons';
import IconButton from '@components/UI/IconButton';
import charOptions from './ChartOptions';
import { ChartContext, ChartContextType } from './ChartContext';

type ChartProps = {
  chartHeight: number | string;
  showToolbar?: boolean | undefined;
} & PropsWithChildren;

type SerieColorName = {
  name: string;
  color: string;
};
// Define a custom time formatter function
const customTimeFormatter = (time: Time) => `${time}`; // Custom date format YYYY-MM-DD
export default function ChartContainer({
  children,
  chartHeight,
  showToolbar,
}: ChartProps) {
  const chart = useRef<ChartContextType>();
  const chartContainerRef = useRef<HTMLInputElement | null>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const timeoutId = useRef<NodeJS.Timeout>();
  const seriesName = useRef<SerieColorName[]>([]);
  const legend = useRef<HTMLDivElement>();

  const listSeriesName = useCallback(
    (name: string, color: string) => {
      // This function increments the count state
      seriesName.current = seriesName.current.filter(
        (item) => item.name !== name
      );
      seriesName.current = [...seriesName.current, { name, color }];

      if (legend.current) {
        // Create and style the tooltip html element
        legend.current.innerHTML = seriesName.current
          .map((item) => `<li style="color: ${item.color};">${item.name}</li>`)
          .join('');
      }
    },
    [seriesName]
  );

  const removelistSeriesName = useCallback((name: string) => {
    // This function increments the count state
    seriesName.current = seriesName.current.filter(
      (item) => item.name !== name
    );
    console.log(seriesName.current);
  }, []);

  useEffect(() => {
    if (chartContainerRef.current) {
      chartContainerRef.current.innerHTML = '';
      charOptions.width = chartContainerRef.current.offsetWidth;
      charOptions.height = chartContainerRef.current.offsetHeight;

      legend.current = document.createElement('div');
      legend.current.style = `position: absolute; left: 250px; top: 12px; z-index: 1; font-size: 14px; font-family: sans-serif; line-height: 18px; font-weight: 300;`;
      legend.current.style.color = 'black';
      chartContainerRef.current.appendChild(legend.current);

      chart.current = {
        chart: createChart(chartContainerRef.current, charOptions),
        listSeriesName,
        removelistSeriesName,
      };
      chart.current.chart.timeScale().fitContent();
    }
  }, [listSeriesName, removelistSeriesName]);

  function downloadChartsPng() {
    if (chart.current) {
      const screenshot = chart.current.chart.takeScreenshot();

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
      chart.current.chart.applyOptions({
        timeScale: {
          tickMarkFormatter: customTimeFormatter,
        },
      });
    }
  }

  function resetZoom() {
    if (chart.current) {
      chart.current.chart.timeScale().fitContent();
    }
  }

  useEffect(() => {
    resizeObserver.current = new ResizeObserver((entries) => {
      if (entries.length === 0) {
        return;
      }
      if (chart.current) {
        const newRect = entries[0].contentRect;
        chart.current.chart.applyOptions({
          height: newRect.height,
          width: newRect.width,
        });
      }
      timeoutId.current = setTimeout(() => {
        if (chart.current) {
          chart.current.chart.timeScale().fitContent();
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
