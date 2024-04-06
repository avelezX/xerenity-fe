import React, {
    forwardRef,
    useEffect,
} from 'react';
import { defaultCustomFormat } from '@models/lightserie';

import { TimeValueSerie } from './Models';
import {useChartContext} from './ChartContext';


const LineSerie = forwardRef(({data,color,title,children,scaleId}:TimeValueSerie) => {
    const chartContext = useChartContext();

    useEffect(() => {
        if(chartContext){
        const newSerie=chartContext.addLineSeries(
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

LineSerie.displayName = 'LineSeries';

export default LineSerie;
