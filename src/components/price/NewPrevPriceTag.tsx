import { Badge,  Col,  Row } from 'react-bootstrap'
import React,{ PropsWithChildren } from "react"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
    faArrowDown,
    faArrowUp,
  } from '@fortawesome/free-solid-svg-icons'

  
type NewPrevProps = {
    current:number;
    prev:number;
} & PropsWithChildren

export default function NewPrevTag(props:NewPrevProps){
    const { current, prev,children } = props
    let bg
    let icn
    if(current - prev <=0){
        bg='success'
        icn=faArrowDown
    }else{
        bg='danger'
        icn=faArrowUp
    }
    return (        
        <Badge bg={bg}>
            <Row>
                <Col sm={1}>
                    <FontAwesomeIcon icon={icn}/>
                </Col>
                <Col>
                    {children}
                </Col>
            </Row>            
        </Badge>
    )
}