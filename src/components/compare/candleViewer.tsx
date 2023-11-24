import Container from 'react-bootstrap/Container'
import { CandleSerie } from '@models/tes'
import { createChart, ColorType } from 'lightweight-charts';
import React, { useEffect, useRef,useState } from 'react';
import { Card,Row,Col } from 'react-bootstrap'


type ViewerProps={
    candleSerie:CandleSerie;
    chartName:string;
}

export default function CandleSerieViewer({candleSerie,chartName}:ViewerProps){

  useEffect(()=>{
    const container=document.getElementById('chartcontainer')
    if(container){
      
      container.innerHTML = '';
      const lineWidth = 2;

      const element = document.createElement('div');      
      
      const chartOptions={ 
        width: 1000, 
        height: 800,
        type:'solid',
        color:'transparent',
        layout: {
          background: { 
            color: "#ffffff" },
            textColor: "#C3BCDB",
        }
      }
      
      const chart = createChart(element,chartOptions);
      
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

      var avgPrice=0

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a', downColor: '#ef5350', borderVisible: true,
      wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    });
      
      let serieData= new Array()
      let volData= new Array()

      candleSerie.values.forEach((tes)=>{        
        avgPrice+=tes.close
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


      const avgPriceLine = {
        price: avgPrice/serieData.length,
        color: 'black',
        lineWidth: lineWidth,
        lineStyle: 1, // LineStyle.Dotted
        axisLabelVisible: true,
        title: 'ave price',
      };
      

      candlestickSeries.setData(serieData)

      volumeSeries.setData(volData)

      chart.timeScale().fitContent();
      
      container.appendChild(element)


      const legend = document.createElement('div');
      legend.style = `position: absolute; left: 12px; top: 12px; z-index: 1; font-size: 14px; font-family: sans-serif; line-height: 18px; font-weight: 300;`;
      container.appendChild(legend);      
      const firstRow = document.createElement('div');
      firstRow.innerHTML = chartName;
      legend.appendChild(firstRow);      
      firstRow.innerHTML = `<h2>${chartName}</h2>`;

    }
  })


  useEffect(()=>{
    console.log('chnaged')
  })

  return (
    <Container>
      <Row>
        <Col>
          <Card>
            <Container fluid id='chartcontainer' />
          </Card>
        </Col>
      </Row>            
    </Container>
  )
}
