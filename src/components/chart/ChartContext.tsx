import { createContext, useContext } from 'react';
import { IChartApi } from 'lightweight-charts';

export type ChartContextType = {
  chart: IChartApi;
  listSeriesName: (name: string, color: string) => void;
  removelistSeriesName: (name: string) => void;
};

export const ChartContext = createContext<ChartContextType | undefined>(
  undefined
);

export function useChartContext() {
  const context = useContext(ChartContext);
  return context;
}

export default useChartContext;
