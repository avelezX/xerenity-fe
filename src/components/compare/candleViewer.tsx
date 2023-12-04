import Container from 'react-bootstrap/Container'
import { CandleSerie } from '@models/tes'
import { CandlestickData, HistogramData, Time, WhitespaceData, createChart } from 'lightweight-charts'
import React, { useEffect } from 'react'
import { Card } from 'react-bootstrap'
import { LightSerie } from '@models/lightserie'

type ViewerProps={
    candleSerie:CandleSerie | null;
    otherSeries:LightSerie[] | null;
    chartName:string;
    fit:boolean;
}

export default function CandleSerieViewer({candleSerie,chartName,otherSeries,fit}:ViewerProps){

  useEffect(()=>{
    const container=document.getElementById('chartcontainer')

    if(container){
      
      container.innerHTML = ''
      
      const element = document.createElement('div')
      
      const chartOptions={
        width: container.offsetWidth,
        height: container.offsetHeight,
        type:'solid',
        color:'transparent',
        layout: {
          background: { 
            color: 'transparent' },
            textColor: "#C3BCDB",
        },
        watermark: {
          visible: true,
          fontSize: 100,
          color: '#D3D3D3',
          text: 'Xerenity',
        }
      }
      
      const chart = createChart(element,chartOptions)


      if(candleSerie){
        const serieData: (WhitespaceData<Time> | CandlestickData<Time>)[] | { time: string; open: number; high: number; low: number; close: number }[]= []
        const volData: (WhitespaceData<Time> | HistogramData<Time>)[] | { time: string; value: number }[]= []
  
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
            color: '#2270E2',
            priceFormat: {
              type: 'volume',
            },
            priceScaleId: 'volume'
            
          }
        )
  
        volumeSeries.priceScale().applyOptions({
          // set the positioning of the volume series
          scaleMargins: {
              top: 0.9, // highest point of the series will be 70% away from the top
              bottom: 0.0,
          },
        })
  
        const candlestickSeries = chart.addCandlestickSeries(
          {
              upColor: '#26a69a', 
              downColor: '#ef5350',
              borderVisible: true,
              wickUpColor: '#26a69a', 
              wickDownColor: '#ef5350',
              priceScaleId: 'right',
              
          }
        )
  
        candlestickSeries.setData(serieData)
  
        volumeSeries.setData(volData)
      }

      if(otherSeries){
        const legend = document.createElement('div')
        legend.setAttribute('style' , `position: absolute; left: 12px; top: 12px; z-index: 1; font-size: 14px; font-family: sans-serif; line-height: 18px; font-weight: 300;`)
        container.appendChild(legend)
        const firstRow = document.createElement('div')
        let iner: string =''
        otherSeries.forEach((other,index)=>{
          if(other.name){
            iner=`<a style={{backgroundColor:${other.color}}}>${other.name}</a><br/> ${iner}` 
          }
          
          const otherSerieChart = chart.addLineSeries(
            { 
              color: other.color,
              priceScaleId: index===0?('right'):(other.name),
              priceFormat: {
                type: 'price'
              } 
            }
          )
          otherSerieChart.setData(other.serie)
        })
        firstRow.innerHTML=iner
        legend.appendChild(firstRow)
      }

      new ResizeObserver(entries => {
        if (entries.length === 0 || entries[0].target !== container) { return }        
        const newRect = entries[0].contentRect
        chart.applyOptions({ height: newRect.height, width: newRect.width })

      }).observe(container)

      if(fit){
        chart.timeScale().fitContent()
      }      
      
      container.appendChild(element)
    }
  })

  return (
      <Card style={{width:'100%',height:'50rem'}}>
        {
          chartName?
          (
            <Card.Header>          
                <h2>{chartName}</h2>
            </Card.Header>
          ):
          (
            null
          )
        }
        <Card.Body style={{width:'100%',height:'100%'}}>
          <Container id='chartcontainer' style={{width:'100%',height:'100%'}}/>
        </Card.Body>
      </Card>
  )
}
