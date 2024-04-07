import { LightSerieValue } from "@models/lightserie";
import { TesYields } from "@models/tes";
import { DeepPartial, IChartApi, PriceScaleOptions } from "lightweight-charts";
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
}& PropsWithChildren & DeepPartial<PriceScaleOptions>;

export type CandleSerieProps={
    data: TesYields[];
    title?:string;
    scaleId?:string;
}& PropsWithChildren;