import Container from 'react-bootstrap/Container'
import React from 'react'
import { Serie } from '@models/serie'
import Card from 'react-bootstrap/Card'
import DisplaySerie from '@components/compare/CompareSeries'

type ViewerProps={
    allSeries:Serie[];
    chartName:string;
}

export default function CardSeries({allSeries,chartName}:ViewerProps){
    
    return (
        <Container>
            <Card >
                <Card.Header>{chartName}</Card.Header>
                <Card.Body>
                    <DisplaySerie allSeries={allSeries} chartName=''/>
                </Card.Body>
            </Card>                  
        </Container>
    )
}
