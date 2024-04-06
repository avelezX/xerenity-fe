import ChartContainer from "./ChartContainer";
import LineSerie from "./LineSerie";
import BarSerie from "./BarSerie";



const Chart = Object.assign(ChartContainer,{
    Line:LineSerie,
    Bar:BarSerie,
});

export default Chart;