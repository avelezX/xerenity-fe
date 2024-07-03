'use client';

import { CoreLayout } from '@layout';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Row } from 'react-bootstrap';
import React, { useState, useEffect, useCallback } from 'react';
import Container from 'react-bootstrap/Container';

import { ExportToCsv, downloadBlob } from 'src/utils/downloadCSV';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faFileCsv, faLandmark } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import PageTitle from '@components/PageTitle';
import { CopNdf } from 'src/types/condf';
import Toolbar from '@components/UI/Toolbar';
import Button from '@components/UI/Button';
import DataTableBase from '@components/Table/BaseTable';

import NdfColumns from '../../components/Table/columnDefinition/copndf/_tableColumnDefinition';

const PAGE_TITLE = 'COP NDF';

export default function NdfCopViewer() {
  const supabase = createClientComponentClient();

  const [copndfGrid, setCopNdfGrid] = useState<CopNdf[]>([]);

  const fetchCodNDFGrid = useCallback(async () => {
    const { data, error } = await supabase
      .schema('xerenity')
      .from('cop_ndf_last_day_query')
      .select('*')
      .order('days_diff_effective_expiration', { ascending: true });
    if (error) {
      setCopNdfGrid([]);
      toast.error(error.message);
    } else if (data) {
      setCopNdfGrid(data as CopNdf[]);
    } else {
      setCopNdfGrid([]);
    }
  }, [supabase, setCopNdfGrid]);

  useEffect(() => {
    fetchCodNDFGrid();
  }, [fetchCodNDFGrid]);

  const downloadSeries = () => {
    const allValues: string[][] = [];
    allValues.push(['Plazo', 'Operaciones']);

    copndfGrid.forEach((entry) => {
      allValues.push([
        entry.days_diff_effective_expiration.toString(),
        entry.trade_count.toString(),
      ]);
    });

    const csv = ExportToCsv(allValues);

    downloadBlob(csv, 'xerenity_series.csv', 'text/csv;charset=utf-8;');
  };

  return (
    <CoreLayout>
      <Container fluid className="px-4 pb-3">
        <Row>
          <div className="d-flex align-items-center gap-2 py-1">
            <PageTitle>
              <Icon icon={faLandmark} size="1x" />
              <h4>{PAGE_TITLE}</h4>
            </PageTitle>
          </div>
        </Row>
        <Row>
          <div className="d-flex justify-content-end pb-3">
            <Toolbar>
              <Button variant="outline-primary" onClick={downloadSeries}>
                <Icon icon={faFileCsv} className="mr-4" />
                Descargar
              </Button>
            </Toolbar>
          </div>
        </Row>
        <DataTableBase columns={NdfColumns} data={copndfGrid} fixedHeader />
      </Container>
    </CoreLayout>
  );
}
