import React, {
    forwardRef,
    useEffect,
    useRef,
} from 'react';
import { defaultCustomFormat } from '@models/lightserie';
import { ISeriesApi, } from 'lightweight-charts';

import { TimeValueSerie } from '../../Models';
import {useChartContext} from '../../ChartContext';
import BarSeriesOptions from './Options';

const BarSerie = forwardRef(({data,color,title,children,scaleId}:TimeValueSerie) => {
    const chartContext = useChartContext();

    const thisChart = useRef<ISeriesApi| null>(null);

    useEffect(() => {
        if(chartContext){
            
            if(thisChart.current){
                chartContext.removeSeries(thisChart.current);
            }

            const serie=chartContext.addHistogramSeries(
                {
                    color,
                    priceFormat: defaultCustomFormat,
                    priceScaleId: scaleId || title,
                    title
                }
            );
            
            serie.setData(data);
            thisChart.current=serie;
            chartContext.timeScale().fitContent();
            
        }
    }); 

    return (
        <div>
            {children}
        </div>  
    );
});

BarSerie.displayName = 'BarSerie';

export default BarSerie;
