'use client';

import React, { useEffect } from 'react';
import { Container } from 'react-bootstrap';
import styled from 'styled-components';
import { CoreLayout } from '@layout';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faMoneyBillTrendUp,
  faFileCsv,
} from '@fortawesome/free-solid-svg-icons';
import useAppStore from 'src/store';
import { ExportToCsv, downloadBlob } from 'src/utils/downloadCSV';

import HeroBlock from '@components/inflation/v2/HeroBlock';
import TrendBlock from '@components/inflation/v2/TrendBlock';
import SmallMultiples from '@components/inflation/v2/SmallMultiples';
import DecompositionBlock from '@components/inflation/v2/DecompositionBlock';
import CityRanking from '@components/inflation/v2/CityRanking';
import CoreInflationPanel from '@components/inflation/v2/CoreInflationPanel';

const TOTAL_ID = 1;

const Topbar = styled.div`
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px; padding: 4px 0;
`;
const Heading = styled.div`
  display: flex; align-items: center; gap: 12px;
  h2 { margin: 0; font-size: 22px; font-weight: 700; color: #212529; }
  .subtitle { font-size: 12px; color: #6E6B7B; margin-top: 2px; }
`;
const ExportBtn = styled.button`
  display: inline-flex; align-items: center; gap: 6px;
  background: #fff; border: 1px solid #DEDEDE; border-radius: 8px;
  padding: 7px 12px; font-size: 12px; font-weight: 500; color: #212529;
  cursor: pointer;
  &:hover { background: #F5F5F7; }
`;

const Footer = styled.div`
  margin-top: 24px;
  padding: 12px 0;
  border-top: 1px solid #ECECEE;
  font-size: 10px; color: #A6A6A6;
  display: flex; flex-wrap: wrap; gap: 16px;
`;

export default function InflationPage() {
  const loadInflationCatalog = useAppStore((s) => s.loadInflationCatalog);
  const loadCanastaSeries = useAppStore((s) => s.loadCanastaSeries);
  const loadCanastaSnapshot = useAppStore((s) => s.loadCanastaSnapshot);
  const loadContributions = useAppStore((s) => s.loadContributions);
  const seriesByCanasta = useAppStore((s) => s.seriesByCanasta);

  useEffect(() => {
    loadInflationCatalog();
    loadCanastaSeries(TOTAL_ID);
    loadCanastaSnapshot(TOTAL_ID);
    loadContributions(36);
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
      <Container fluid className="px-4 pb-3" style={{ background: '#FAFAFB', minHeight: '100vh' }}>
        <Topbar>
          <Heading>
            <Icon icon={faMoneyBillTrendUp} size="lg" color="#786CF7" />
            <div>
              <h2>Inflación Colombia</h2>
              <div className="subtitle">DANE · empalmado BanRep desde 1954 · 25 ciudades · medidas de núcleo</div>
            </div>
          </Heading>
          <ExportBtn onClick={downloadCsv}>
            <Icon icon={faFileCsv} /> Exportar CSV
          </ExportBtn>
        </Topbar>

        <HeroBlock />
        <TrendBlock />
        <SmallMultiples />
        <DecompositionBlock />
        <CityRanking />
        <CoreInflationPanel />

        <Footer>
          <div>Fuente: DANE — Sistema Estadístico Nacional (SEN)</div>
          <div>Histórico headline: BanRep id=7 (IPC base 2018=100)</div>
          <div>Núcleo: BanRep — Inflación básica</div>
          <div>Última actualización: {new Date().toLocaleDateString('es-CO')}</div>
        </Footer>
      </Container>
      <ToastContainer />
    </CoreLayout>
  );
}
