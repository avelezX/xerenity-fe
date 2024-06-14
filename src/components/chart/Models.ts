import { LightSerieValue } from 'src/types/lightserie';
import { TesYields } from 'src/types/tes';
import { IChartApi } from 'lightweight-charts';
import { PropsWithChildren } from 'react';

export interface ChartRefObject {
  isRemoved: boolean;
  api?: IChartApi;
}

export type TimeValueSerie = {
  data: LightSerieValue[];
  color: string;
  title: string;
  scaleId?: string;
  applyFunctions?: string[];
} & PropsWithChildren;

export type CandleSerieProps = {
  data: TesYields[];
  title?: string;
  scaleId?: string;
} & PropsWithChildren;
