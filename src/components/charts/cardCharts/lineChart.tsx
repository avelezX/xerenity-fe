import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Table } from 'react-bootstrap'
import { useState, useEffect, useCallback } from "react";
import { BanrepSerieValue,BanrepSerie } from '@models/banrep';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import NavDropdown from 'react-bootstrap/NavDropdown';
import Nav from 'react-bootstrap/Nav';
import React from 'react';
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
} from 'chart.js';
import { Serie } from '@models/serie';
import dynamic from 'next/dynamic';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import DisplaySerie from '@components/compare/CompareSeries';

type ViewerProps={
    allSeries:Serie[]
    chartName:string
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
    );
}