const BaseOptions = {};

const MarginOptions = {
  scaleMargins: {
    top: 0.9, // highest point of the series will be 70% away from the top
    bottom: 0.0,
  },
};

const CandleSerieOptions = Object.assign(BaseOptions, {
  Margin: MarginOptions,
});

export default CandleSerieOptions;
