import React, {
    forwardRef,
    useEffect,
    useRef,
} from 'react';
import { defaultCustomFormat } from '@models/lightserie';
import { ISeriesApi, } from 'lightweight-charts';

import { TimeValueSerie } from '../../Models';
import {useChartContext} from '../../ChartContext';



/*
    Documentation can be found
    https://tradingview.github.io/lightweight-charts/docs/series-types#line
*/
const LineSerie = forwardRef(({data,color,title,children,scaleId}:TimeValueSerie) => {
    const chartContext = useChartContext();

    const thisChart = useRef<ISeriesApi<"Line"> | null>(null);

    useEffect(() => {
        if(chartContext){
            
            if(thisChart.current){                
                thisChart.current.applyOptions({
                    color,
                    priceFormat: defaultCustomFormat,
                    priceScaleId: scaleId || title,
                    title
                });                
            }else{
                const serie=chartContext.addLineSeries(
                    {
                        color,
                        priceFormat: defaultCustomFormat,
                        priceScaleId: scaleId || title,
                        title
                    }
                );                
                thisChart.current=serie;
            }

            thisChart.current.setData(data);            
            chartContext.timeScale().fitContent();
            
        }
    });  

    return (
        <div>
            {children}
        </div>  
    );
});

LineSerie.displayName = 'LineSeries';

export default LineSerie;
