
import Container from 'react-bootstrap/Container'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import React from 'react'
import { Serie } from '@models/serie'

type ViewerProps={
    allSeries:Serie[];
    chartName:string;
}

export default function DisplaySerie({allSeries,chartName}:ViewerProps){
    
    return (
        <Container>
          <Row>
            <Col>
 
            </Col>
          </Row>            
        </Container>
    )
}
