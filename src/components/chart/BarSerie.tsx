import React, {
    forwardRef,
    useContext,
    useImperativeHandle,
    useRef,
} from 'react';
import { defaultPriceFormat } from '@models/lightserie';

import { ChartRefObject,TimeValueSerie } from './Models';
import ChartContext from './ChartContext';


const BarSerie = forwardRef(({data,color,title,children,scaleId}:TimeValueSerie,ref) => {
    const parent = useContext(ChartContext);

    const context = useRef<ChartRefObject>({
        isRemoved: false,
        api:parent?.api,
    });

    if(parent){
        if(parent.api){
            
            const newSerie=parent.api.addHistogramSeries(
            {
                color,priceFormat: defaultPriceFormat,priceScaleId: scaleId || title,title,}
            );                
            newSerie.setData(data);
        }
    }
    useImperativeHandle(ref, () => context.current.api, []);

    return (
        <ChartContext.Provider value={context.current}>
            {children}
        </ChartContext.Provider>
    );
});

BarSerie.displayName = 'BarSerie';

export default BarSerie;
