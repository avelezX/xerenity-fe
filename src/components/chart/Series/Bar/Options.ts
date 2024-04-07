
const BaseOptions ={
};

export const VolumeOptions={
    scaleMargins: {
        top: 0.9, // highest point of the series will be 70% away from the top
        bottom: 0.0,
    }
};

export const scaleMargins={
    top: 0.9, // highest point of the series will be 70% away from the top
    bottom: 0.0, 
};

const BarSeriesOptions = Object.assign(BaseOptions,{
    Margin:VolumeOptions,
});

export default BarSeriesOptions;