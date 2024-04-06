import { createContext, useContext } from "react";
import { IChartApi } from "lightweight-charts";

export const ChartContext = createContext<IChartApi | undefined>( undefined);

export function useChartContext(){
    const context = useContext(ChartContext);
    return context;
}

export default useChartContext;