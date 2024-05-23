import ChartContainer from './ChartContainer';
import LineSerie from './Series/Line/LineSerie';
import BarSerie from './Series/Bar/BarSerie';
import CandleSerie from './Series/Candle/CandleSerie';
import VolumenBarSerie from './Series/Bar/VolumenSerie';

const Chart = Object.assign(ChartContainer, {
  Line: LineSerie,
  Bar: BarSerie,
  Candle: CandleSerie,
  Volume: VolumenBarSerie,
});

export default Chart;
