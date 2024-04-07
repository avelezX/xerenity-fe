import ChartContainer from "./ChartContainer";
import LineSerie from "./Series/Line/LineSerie";
import BarSerie from "./Series/Bar/BarSerie";



const Chart = Object.assign(ChartContainer,{
    Line:LineSerie,
    Bar:BarSerie,
});

export default Chart;