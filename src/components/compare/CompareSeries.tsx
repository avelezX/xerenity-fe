
import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import React, { useState, useEffect, useCallback } from 'react'
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
    chartType:
      | "line"
      | "area"
}

export default function DisplaySerie({allSeries,chartName,chartType}:ViewerProps){

    const [longetsSeries,setLongestSeries] = useState<Serie>()


    
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
                    yaxis: [
                      {
                        axisTicks: {
                          show: true,
                        },
                        axisBorder: {
                          show: true,
                          color: '#008FFB'
                        },
                        labels: {
                          style: {
                            colors: '#008FFB',
                          }
                        },
                        title: {
                          text: "Income (thousand crores)",
                          style: {
                            color: '#008FFB',
                          }
                        },
                        tooltip: {
                          enabled: true
                        }
                      },
                      {
                        seriesName: 'Income',
                        opposite: true,
                        axisTicks: {
                          show: true,
                        },
                        axisBorder: {
                          show: true,
                          color: '#00E396'
                        },
                        labels: {
                          style: {
                            colors: '#00E396',
                          }
                        },
                        title: {
                          text: "Operating Cashflow (thousand crores)",
                          style: {
                            color: '#00E396',
                          }
                        },
                      },
                      {
                        seriesName: 'Revenue',
                        opposite: true,
                        axisTicks: {
                          show: true,
                        },
                        axisBorder: {
                          show: true,
                          color: '#FEB019'
                        },
                        labels: {
                          style: {
                            colors: '#FEB019',
                          },
                        },
                        title: {
                          text: "Revenue (thousand crores)",
                          style: {
                            color: '#FEB019',
                          }
                        }
                      },
                    ]
                    ,
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
                          data: serie.values.map((val,idx) => ({
                              x: idx,
                              y: val.value
                        }))
                      }
                    )
                  )
                }                
              />              
              }    
            </Col>
          </Row>            
        </Container>
    )
}
