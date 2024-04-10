import {LightSerieValue } from '@models/lightserie';

export default function normalizeSeries(existinSeries: LightSerieValue[]):LightSerieValue[] {
  
  const nSerie = new Array<LightSerieValue>();
  
  if(existinSeries.length>0){
    existinSeries.forEach((entry) => {
      nSerie.push({
        value: entry.value / existinSeries[0].value,
        time: entry.time,
      });
    });
  }

  return nSerie;
}
