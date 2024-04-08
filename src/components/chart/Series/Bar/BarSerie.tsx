import React, {
    useEffect,
    useRef,
} from 'react';
import { defaultCustomFormat } from '@models/lightserie';
import { ISeriesApi, } from 'lightweight-charts';

import { TimeValueSerie } from '../../Models';
import {useChartContext} from '../../ChartContext';

/*
    Documentation can be found
    https://tradingview.github.io/lightweight-charts/docs/series-types#histogram

    https://tradingview.github.io/lightweight-charts/docs/api/interfaces/IChartApi#addhistogramseries
*/
function BarSerie({data,color,title,children,scaleId,scaleMargins}:TimeValueSerie) {
    const chartContext = useChartContext();

    const thisChart = useRef<ISeriesApi<"Histogram"> | null>(null);

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
                const serie=chartContext.addHistogramSeries(
                    {
                        color,
                        priceFormat: defaultCustomFormat,
                        priceScaleId: scaleId || title,
                        title
                    }
                );                
                thisChart.current=serie;
            }
            if(data){
                thisChart.current.setData(data);
            }
            if(scaleMargins){
                thisChart.current.priceScale().applyOptions({scaleMargins});         
            }
            chartContext.timeScale().fitContent();
            
        }
    }); 

    useEffect(() => () =>{if(thisChart.current)chartContext?.removeSeries(thisChart.current);}, [chartContext]);
    
    return (
        <div>
            {children}
        </div>  
    );
};

export default BarSerie;
