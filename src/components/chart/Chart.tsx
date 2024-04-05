import { createChart} from 'lightweight-charts';
import React, {
    forwardRef,
    useCallback,
    useImperativeHandle,
    useLayoutEffect,
    useRef,
    useState,
    PropsWithChildren,
} from 'react';

import charOptions from './ChartOptions';
import ChartContext from './ChartContext';
import { ChartRefObject } from './Models';


type ChartContainerProps={
    container: HTMLElement;
}& PropsWithChildren;


export const ChartContainer = forwardRef(({ children, container }:ChartContainerProps, ref) => {
    
    charOptions.width = 1000;
    charOptions.height = 800;

    const chartApiRef = useRef<ChartRefObject>({
        isRemoved: false,
        api:createChart(container, charOptions)
    });
    if(chartApiRef.current.api){
        chartApiRef.current.api.timeScale().fitContent();
    }    
    
    useLayoutEffect(() => {
        const currentRef = chartApiRef.current;
        const chart = currentRef.api;

        const handleResize = () => {
        if(chart){
            chart.applyOptions({
            width: container.clientWidth,
        });
        }

        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            chartApiRef.current.isRemoved = true;
        };
    }, [container.clientWidth]);
    

    useImperativeHandle(ref, () => chartApiRef.current.api, []);

    return (
        <ChartContext.Provider value={chartApiRef.current}>
            {children}
        </ChartContext.Provider>
    );
});
ChartContainer.displayName = 'ChartContainer';


export default function Chart({children}:PropsWithChildren) {
    const [container, setContainer] = useState<HTMLElement>();      
    const handleRef = useCallback((ref:HTMLDivElement) => setContainer(ref), []);
    return (
        <div ref={handleRef}>
            {container && <ChartContainer  container={container} >
                {children}
            </ChartContainer>}
        </div>
    );
}