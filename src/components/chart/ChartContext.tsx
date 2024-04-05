import { createContext } from "react";
import { ChartRefObject } from "./Models";

const ChartContext = createContext<ChartRefObject | undefined>( undefined);

export default ChartContext;