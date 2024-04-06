'use client';

import React from 'react';
import {  Row, Col } from 'react-bootstrap';
import { CoreLayout } from '@layout';
import 'react-toastify/dist/ReactToastify.css';
import tokens from 'design-tokens/tokens.json';
import Chart from '@components/chart/Chart';



const designSystem = tokens.xerenity;
const PURPLE_COLOR_100 = designSystem['purple-100'].value;
const GREY_COLOR_300 = designSystem['gray-300'].value;


const initialData = [
  { time: '2018-10-11', value: 52.89 },
  { time: '2018-10-12', value: 51.65 },
  { time: '2018-10-13', value: 51.56 },
  { time: '2018-10-14', value: 50.19 },
  { time: '2018-10-15', value: 51.86 },
  { time: '2018-10-16', value: 51.25 },
];

const initialData2 = [
  { time: '2018-10-11', value: 31.89 },
  { time: '2018-10-12', value: 33.65 },
  { time: '2018-10-13', value: 34.56 },
  { time: '2018-10-14', value: 35.19 },
  { time: '2018-10-15', value: 36.86 },
  { time: '2018-10-16', value: 37.25 },
];

export default function NextPage() {

  return (
    <CoreLayout>
        <Row>
          <Col>            
            <Chart>
              <Chart.Line
                data={initialData}
                color={GREY_COLOR_300}
                scaleId='left'
                title='Balance final (Izquierdo)'
              />
              <Chart.Bar
                data={initialData2}
                color={PURPLE_COLOR_100}
                scaleId='right'
                title='Balance final (Izquierdo)'
              />
            </Chart>
          </Col>
        </Row>
    </CoreLayout>
  );
}
