import { Badge, Card, Col, Stack, Row } from 'react-bootstrap'
import React,{ useState, useEffect, useCallback,PropsWithChildren } from "react"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowDown,
    faArrowUp,
  } from '@fortawesome/free-solid-svg-icons'

  
type NewPrevProps = {
    current:number;
    prev:number;
} & PropsWithChildren

export default function NewPrevTag(props:NewPrevProps){
    let bg
    let icn
    if(props.current - props.prev <=0){
        bg='success'
        icn=faArrowUp
    }else{
        bg='danger'
        icn=faArrowDown
    }
    return (        
        <Badge bg={bg}>
            <Row>
                <Col sm={1}>
                    <FontAwesomeIcon icon={icn}/>
                </Col>
                <Col>
                    {props.children}
                </Col>
            </Row>            
        </Badge>
    )
}