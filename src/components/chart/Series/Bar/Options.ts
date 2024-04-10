
const BaseOptions ={
};

export const scaleMargins={
    top: 0.1, // highest point of the series will be 70% away from the top
    bottom: 0.1, 
};
export const priceFormat={
    type: 'volume',
};
const BarSeriesOptions = Object.assign(BaseOptions,{
    Margin:scaleMargins,
    PriceFormat:priceFormat,
});

export default BarSeriesOptions;