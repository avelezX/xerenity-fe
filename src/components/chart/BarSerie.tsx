import React, {
    forwardRef,
    useEffect,
} from 'react';
import { defaultCustomFormat } from '@models/lightserie';

import { TimeValueSerie } from './Models';
import {useChartContext} from './ChartContext';


const BarSerie = forwardRef(({data,color,title,children,scaleId}:TimeValueSerie) => {
    const chartContext = useChartContext();

    useEffect(() => {
        if(chartContext){
        const newSerie=chartContext.addHistogramSeries(
            {
                color,
                priceFormat: defaultCustomFormat,
                priceScaleId: scaleId || title,
                title
            }
        );                
            newSerie.setData(data);
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
