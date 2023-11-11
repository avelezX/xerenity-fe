
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
import { Serie } from '@models/serie'
import dynamic from 'next/dynamic'

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
    allSeries:Serie[];
    chartName:string;
}

export default function DisplaySerie({allSeries,chartName}:ViewerProps){
    
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
                      }
                    },
                    grid: {
                      borderColor: '#e7e7e7',
                      row: {
                        colors: ['#f3f3f3', 'transparent'],
                        opacity: 0.5
                      },
                    },                    
                  }
                } 
                series={
                    allSeries.map((serie) => (
                        {
                            name: serie.name,
                            data: serie.values.map((val) => ({
                                x: val.fecha,
                                y: val.value
                          }))
                        }
                    )
                )
                }
                type="area"
                
              />              
              }    
            </Col>
          </Row>            
        </Container>
    )
}
