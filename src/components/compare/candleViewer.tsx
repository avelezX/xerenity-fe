import Container from 'react-bootstrap/Container'
import { CandleSerie } from '@models/tes'
import { createChart } from 'lightweight-charts'
import React, { useEffect } from 'react'
import { Card, Stack } from 'react-bootstrap'
import { LightSerie } from '@models/lightserie'

type ViewerProps={
    candleSerie:CandleSerie | null;
    otherSeries:LightSerie[] | null
    chartName:string;
    fit:boolean;
}

const randomColor = (): string => {
  let result = '';
  for (let i = 0; i < 6; ++i) {
    const value = Math.floor(16 * Math.random());
    result += value.toString(16);
  }
  return '#' + result;
}

export default function CandleSerieViewer({candleSerie,chartName,otherSeries,fit}:ViewerProps){

  useEffect(()=>{
    const container=document.getElementById('chartcontainer')

    if(container){
      
      container.innerHTML = '';
      
      const element = document.createElement('div');
      
      const chartOptions={
        width: container.offsetWidth,
        height: container.offsetHeight,
        type:'solid',
        color:'transparent',
        layout: {
          background: { 
            color: "#ffffff" },
            textColor: "#C3BCDB",
        }
      }
      
      const chart = createChart(element,chartOptions);


      if(candleSerie){
        let serieData= new Array()
        let volData= new Array()
  
        candleSerie.values.forEach((tes)=>{        
          
          serieData.push(
            {
              time: tes.day.split('T')[0],
              open: tes.open, high: tes.high, low: tes.low, close: tes.close
            }
          )
  
          volData.push(
            {
              time: tes.day.split('T')[0],
              value:tes.volume
            }
          )
        })
        
        const volumeSeries = chart.addHistogramSeries(
          { 
            color: '#3179F5',
            priceFormat: {
              type: 'volume',
            },
            priceScaleId: ''
          }
        );
  
        volumeSeries.priceScale().applyOptions({
          // set the positioning of the volume series
          scaleMargins: {
              top: 0.9, // highest point of the series will be 70% away from the top
              bottom: 0.0,
          },
        });
  
        const candlestickSeries = chart.addCandlestickSeries({
          upColor: '#26a69a', downColor: '#ef5350', borderVisible: true,
          wickUpColor: '#26a69a', wickDownColor: '#ef5350',
        });
  
        candlestickSeries.setData(serieData)
  
        volumeSeries.setData(volData)
      }

      if(otherSeries){
        otherSeries.forEach((other)=>{
          const otherSerieChart = chart.addLineSeries({ color: randomColor() });      
          otherSerieChart.setData(other.serie)
        })
      }

      new ResizeObserver(entries => {
        if (entries.length === 0 || entries[0].target !== container) { return; }        
        const newRect = entries[0].contentRect;
        chart.applyOptions({ height: newRect.height, width: newRect.width });       

      }).observe(container);

      if(fit){
        chart.timeScale().fitContent();
      }      
      
      container.appendChild(element)
    }
  })

  return (
      <Card style={{width:'100%',height:'50rem'}}>
        <Card.Header>
          <Stack direction='horizontal' gap={5}>
            <h2>{chartName}</h2>
          </Stack>
        </Card.Header>
        <Card.Body style={{width:'100%',height:'100%'}}>
          <Container id='chartcontainer' style={{width:'100%',height:'100%'}}/>
        </Card.Body>
      </Card>
  )
}
