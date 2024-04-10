import React, {
    useEffect,
    useRef,
} from 'react';
import { ISeriesApi, } from 'lightweight-charts';

import { TimeValueSerie } from '../../Models';
import {useChartContext} from '../../ChartContext';

/*
    Documentation can be found
    https://tradingview.github.io/lightweight-charts/docs/series-types#histogram

    https://tradingview.github.io/lightweight-charts/docs/api/interfaces/IChartApi#addhistogramseries
*/
function VolumenBarSerie({data,color,title,children,scaleId}:TimeValueSerie) {
    const chartContext = useChartContext();

    const thisChart = useRef<ISeriesApi<"Histogram"> | null>(null);

    useEffect(() => {
        if(chartContext){
            
            if(thisChart.current){                
                thisChart.current.applyOptions({
                    color,              
                    priceFormat: {
                        type: 'volume',
                    },
                    priceScaleId: scaleId,
                    title,
                });                
            }else{
                const serie=chartContext.addHistogramSeries(
                    {
                        color,              
                        priceFormat: {
                            type: 'volume',
                        },
                        priceScaleId: scaleId,
                        title,
                    }
                );                
                thisChart.current=serie;
            }
            if(data){
                thisChart.current.setData(data);
            }
            
            thisChart.current.priceScale().applyOptions({
                // set the positioning of the volume series
                scaleMargins: {
                    top: 0.8, // highest point of the series will be 70% away from the top
                    bottom: 0.0,
                },
            });      
            
            if(chartContext !== undefined){
                chartContext.timeScale().fitContent();
            }
            
        }
    });
    
    useEffect(() => () =>{
        if(thisChart.current){
            if(chartContext){
                chartContext.removeSeries(thisChart.current);
            }
        }
    }, [chartContext]);      

    
    return (
        <div>
            {children}
        </div>  
    );
};

export default VolumenBarSerie;
