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
import InfoCard from '@components/InforCard/InfoCard';

const designSystem = tokens.xerenity;
const GRAY_COLOR_300 = designSystem['gray-300'].value;
const PURPLE_COLOR_100 = designSystem['purple-100'].value;

const PAGE_TITLE = 'Dashboard';

const Dashboard = () => {
  const currentDate = useCallback(calculateCurrentDate, []);
  const {
    getChartUSDCOPData,
    chartUSDCOPData,
    volumechartUSDCOPDData,
    getCpiIndexData,
    chartCPIIndexData,
    chartPoliticaMonetaria,
    getPoliticaMonetariaData,
    dashboardBoxes,
    getDashboardBoxes,
  } = useAppStore();

  useEffect(() => {
    getChartUSDCOPData();
    getCpiIndexData();
    getPoliticaMonetariaData();
    getDashboardBoxes();
  }, [
    getChartUSDCOPData,
    getCpiIndexData,
    getPoliticaMonetariaData,
    getDashboardBoxes,
  ]);

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
                data={chartUSDCOPData}
                scaleId="right"
                title="USD:COP"
              />
              <Chart.Volume
                data={volumechartUSDCOPDData}
                scaleId="left"
                color={GRAY_COLOR_300}
                title="Volumen"
              />
            </Chart>
          </Col>
          <Col sm={2} className="d-flex flex-column gap-3">
            <InfoCard cardData={dashboardBoxes} cardId="b1" />
            <InfoCard cardData={dashboardBoxes} cardId="b2" />
          </Col>
        </Row>
        <Row className="mb-3">
          <Col sm={4}>
            <InfoCard cardData={dashboardBoxes} cardId="b3" />
          </Col>
          <Col sm={4}>
            <InfoCard cardData={dashboardBoxes} cardId="b4" />
          </Col>
          <Col sm={4}>
            <InfoCard cardData={dashboardBoxes} cardId="b5" />
          </Col>
        </Row>
        <Row>
          <Col sm={6}>
            <Chart showToolbar>
              <Chart.Line
                data={chartPoliticaMonetaria}
                color={GRAY_COLOR_300}
                title="Politica monetaria"
                scaleId="right"
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
