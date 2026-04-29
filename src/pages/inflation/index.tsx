'use client';

import React, { useEffect } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { CoreLayout } from '@layout';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faFileCsv,
  faMoneyBillTrendUp,
} from '@fortawesome/free-solid-svg-icons';
import Toolbar from '@components/UI/Toolbar';
import Button from '@components/UI/Button';
import PageTitle from '@components/PageTitle';
import useAppStore from 'src/store';
import { ExportToCsv, downloadBlob } from 'src/utils/downloadCSV';
import InflationKPIs from '@components/inflation/InflationKPIs';
import InflationMainChart from '@components/inflation/InflationMainChart';
import ContributionChart from '@components/inflation/ContributionChart';
import InflationHeatmap from '@components/inflation/InflationHeatmap';
import InflationPivotTable from '@components/inflation/InflationPivotTable';

const PAGE_TITLE = 'Inflación';
const TOTAL_ID = 1;

export default function InflationPage() {
  const loadInflationCatalog = useAppStore((s) => s.loadInflationCatalog);
  const loadCanastaSeries = useAppStore((s) => s.loadCanastaSeries);
  const loadCanastaSnapshot = useAppStore((s) => s.loadCanastaSnapshot);
  const loadContributions = useAppStore((s) => s.loadContributions);
  const seriesByCanasta = useAppStore((s) => s.seriesByCanasta);
  const canastas = useAppStore((s) => s.canastas);

  useEffect(() => {
    loadInflationCatalog();
    loadCanastaSeries(TOTAL_ID);
    loadCanastaSnapshot(TOTAL_ID);
    loadContributions(24);
  }, [
    loadInflationCatalog,
    loadCanastaSeries,
    loadCanastaSnapshot,
    loadContributions,
  ]);

  const downloadCsv = () => {
    const total = seriesByCanasta[TOTAL_ID] || [];
    const rows: string[][] = [['Fecha', 'Indice', 'MoM%', 'YoY%', 'YTD%']];
    total.forEach((p) => {
      rows.push([
        p.time,
        p.indice.toFixed(4),
        p.mom?.toFixed(4) ?? '',
        p.yoy?.toFixed(4) ?? '',
        p.ytd?.toFixed(4) ?? '',
      ]);
    });
    const csv = ExportToCsv(rows);
    downloadBlob(csv, 'xerenity_inflacion.csv', 'text/csv;charset=utf-8;');
  };

  return (
    <CoreLayout>
      <Container fluid className="px-4 pb-3">
        <Row>
          <div
            className="d-flex align-items-center justify-content-between gap-2 py-1"
            style={{ flexWrap: 'wrap' }}
          >
            <PageTitle>
              <Icon icon={faMoneyBillTrendUp} size="1x" />
              <h4>{PAGE_TITLE}</h4>
            </PageTitle>
            <Toolbar>
              <Button variant="outline-primary" onClick={downloadCsv}>
                <Icon icon={faFileCsv} className="mr-4" /> Descargar CSV
              </Button>
            </Toolbar>
          </div>
        </Row>

        <InflationKPIs />

        <Row>
          <Col xs={12} className="mb-3">
            <InflationMainChart />
          </Col>
        </Row>

        <Row>
          <Col xs={12} lg={6} className="mb-3">
            <ContributionChart />
          </Col>
          <Col xs={12} lg={6} className="mb-3">
            <InflationHeatmap />
          </Col>
        </Row>

        <Row>
          <Col xs={12}>
            <InflationPivotTable />
          </Col>
        </Row>

        <div style={{ marginTop: 12, fontSize: 11, color: '#777' }}>
          Fuente: DANE (canasta IPC base 2018=100, 12 divisiones COICOP){' '}
          {canastas.length > 0 ? `· ${canastas.length - 1} divisiones` : ''} ·{' '}
          Histórico headline empalmado vía BanRep desde 1954.
        </div>
      </Container>
      <ToastContainer />
    </CoreLayout>
  );
}
