'use client';

import { useCallback, useEffect } from 'react';
import useAppStore from '@store';
import { CoreLayout } from '@layout';
import { Container, Row, Col } from 'react-bootstrap';
import { faHome, faCalendarAlt } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import PageTitle from '@components/PageTitle';
import { SourcePill } from '@components/UI/Card/Card.styled';
import Chart from '@components/chart/Chart';
import calculateCurrentDate from 'src/utils/calculateCurrentDate';
import tokens from 'design-tokens/tokens.json';
import InfoCard from './_InfoCard';

const designSystem = tokens.xerenity;
const GRAY_COLOR_300 = designSystem['gray-300'].value;
const PURPLE_COLOR_100 = designSystem['purple-100'].value;

const PAGE_TITLE = 'Dashboard';

const Dashboard = () => {
  const currentDate = useCallback(calculateCurrentDate, []);
  const {
    getChartTES33Data,
    chartTES33Data,
    volumeTES33Data,
    getChartUSDCOPData,
    chartUSDCOPData,
    getCpiIndexData,
    chartCPIIndexData,
  } = useAppStore();

  useEffect(() => {
    getChartTES33Data();
    getChartUSDCOPData();
    getCpiIndexData();
  }, [getChartTES33Data, getChartUSDCOPData, getCpiIndexData]);

  return (
    <CoreLayout>
      <Container fluid className="px-4 pb-3">
        <Row>
          <div className="d-flex align-items-center gap-2 py-1">
            <PageTitle>
              <Icon icon={faHome} size="1x" />
              <h4>{PAGE_TITLE}</h4>
            </PageTitle>
          </div>
        </Row>
        <Row>
          <div className="d-flex justify-content-end pb-3">
            <SourcePill>
              <Icon icon={faCalendarAlt} className="mx-2" size="1x" />
              <strong>{`Fecha: ${currentDate()}`}</strong>
            </SourcePill>
          </div>
        </Row>
        <Row className="mb-3">
          <Col sm={10}>
            <Chart showToolbar>
              <Chart.Candle
                data={chartTES33Data}
                scaleId="right"
                title="COLTES 13.25 09/02/33"
              />
              <Chart.Volume
                data={volumeTES33Data}
                scaleId="left"
                color={GRAY_COLOR_300}
                title="Volumen"
              />
            </Chart>
          </Col>
          <Col sm={2} className="d-flex flex-column gap-3">
            <InfoCard title="Lorem Ipsum" value="333.27" />
            <InfoCard title="Lorem Ipsum" value="333.27" />
          </Col>
        </Row>
        <Row className="mb-3">
          <Col sm={4}>
            <InfoCard title="Lorem Ipsum" value="333.27" />
          </Col>
          <Col sm={4}>
            <InfoCard title="Lorem Ipsum" value="333.27" />
          </Col>
          <Col sm={4}>
            <InfoCard title="Lorem Ipsum" value="333.27" />
          </Col>
        </Row>
        <Row>
          <Col sm={6}>
            <Chart showToolbar>
              <Chart.Candle
                data={chartUSDCOPData}
                scaleId="right"
                title="USD:COP"
              />
            </Chart>
          </Col>
          <Col sm={6}>
            <Chart showToolbar>
              <Chart.Bar
                data={chartCPIIndexData}
                color={PURPLE_COLOR_100}
                scaleId="right"
                title="Inflacion total"
              />
            </Chart>
          </Col>
        </Row>
      </Container>
    </CoreLayout>
  );
};

export default Dashboard;
