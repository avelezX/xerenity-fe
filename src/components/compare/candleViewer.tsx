import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import React from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js'
import dynamic from 'next/dynamic'
import { CandleSerie } from '@models/tes'

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false })

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
)

type ViewerProps={
    candleSerie:CandleSerie;
    chartName:string;
    chartHeight:number;
}

export default function CandleSerieViewer({candleSerie,chartName,chartHeight}:ViewerProps){

    return (
        <Container>
          <Row>
            <Col>
            {(typeof window !== 'undefined') &&
              <Chart 
                options={
                  {
                    chart: {
                      type: 'area',
                      height: chartHeight                      
                    },
                    title: {
                      text: chartName,
                      align: 'center'
                    },
                    xaxis: {
                      type: 'datetime'
                    },
                    yaxis: {
                      tooltip: {
                        enabled: true
                      },
                      show: false
                    },
                    grid: {
                      borderColor: '#e7e7e7',
                      row: {
                        colors: ['#f3f3f3', 'transparent'],
                        opacity: 0.5
                      },
                    }                  
                  }
                } 
                series={
                    [
                      {
                        data: candleSerie.values.map(tes => ({
                          x: tes.day,
                          y: [tes.open,tes.high,tes.low,tes.close]
                        }))
                      }
                    ]
                }
                type="candlestick"
              />              
              }    
            </Col>
          </Row>            
        </Container>
    )
}