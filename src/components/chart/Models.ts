import { LightSerieValue } from "@models/lightserie";
import { IChartApi } from "lightweight-charts";
import { PropsWithChildren } from "react";


export interface ChartRefObject {
    isRemoved:boolean;
    api?:IChartApi;
}

export type TimeValueSerie={
    data:LightSerieValue[];
    color:string;
    title:string;
    scaleId?:string;
}& PropsWithChildren;
