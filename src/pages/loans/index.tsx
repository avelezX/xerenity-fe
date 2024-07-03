'use client';

import React, { useEffect, useRef } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { Loan } from 'src/types/loans';
import { CoreLayout } from '@layout';
import { ExportToCsv, downloadBlob } from 'src/utils/downloadCSV';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faFileCsv,
  faMoneyBill,
  faLandmark,
} from '@fortawesome/free-solid-svg-icons';
import Toolbar from '@components/UI/Toolbar';
import tokens from 'design-tokens/tokens.json';
import Chart from '@components/chart/Chart';
import Button from '@components/UI/Button';
import PageTitle from '@components/PageTitle';
import { MultiValue } from 'react-select';
import LoanList from 'src/pages/loans/_LoanList';
import Panel from '@components/Panel';
import MultipleSelect from '@components/UI/MultipleSelect';
import ConfirmationModal from '@components/UI/ConfirmationModal';
import useAppStore from '@store';
import NewCreditModal from './_NewCreditModal';
import LoanDetailsModal from './_LoanDetailsModal';
import CashFlowTable from './_CashflowTable';

const designSystem = tokens.xerenity;
const PURPLE_COLOR_100 = designSystem['purple-100'].value;

const PAGE_TITLE = 'Créditos';
const CONFIRM_MODAL_TITLE = '¿Desea Borrar Este Crédito?';
const DELETE_TXT =
  'Al proceder removera el crédito de la lista y todas sus configuraciones.';

const CSV_FILE = {
  columns: [
    'Fecha',
    'Balance Inicial',
    'Balance Final',
    'Interes',
    'Pago',
    'Principal',
  ],
  name: 'xerenity_flujo_de_caja.csv',
  format: 'text/csv;charset=utf-8;',
};

export default function LoansPage() {
  const {
    banks,
    chartData,
    deleteLoanItem,
    getLoanData,
    loading,
    loans,
    mergedCashFlows,
    showDeleteConfirm,
    showLoanModal,
    showNewCreditModal,
    setSelectedLoans,
    setSelectedBanks,
    onShowDeleteConfirm,
    onShowLoanModal,
    onShowNewLoanModal,
  } = useAppStore();

  const selectedLoan = useRef<Loan>();

  const onDownloadSeries = () => {
    const { name, columns, format } = CSV_FILE;
    const allValues: string[][] = [];

    allValues.push(columns);

    if (mergedCashFlows) {
      mergedCashFlows.forEach(
        ({
          date,
          beginning_balance,
          ending_balance,
          interest,
          payment,
          principal,
        }) => {
          allValues.push([
            date,
            beginning_balance.toString(),
            ending_balance.toString(),
            interest.toString(),
            payment.toString(),
            principal.toString(),
          ]);
        }
      );
    }

    const csv = ExportToCsv(allValues);
    downloadBlob(csv, name, format);
  };

  const onBankFilter = (
    selections: MultiValue<{ value: string; label: string }>
  ) => {
    const selectionValues = selections?.map(({ value }) => ({
      bank_name: value,
    }));
    setSelectedBanks(selectionValues);
  };

  const onShowDetailsLoan = (loan: Loan) => {
    selectedLoan.current = loan;
    onShowLoanModal(true);
  };

  const onDeleteLoan = (loan: Loan) => {
    selectedLoan.current = loan;
    onShowDeleteConfirm(true);
  };

  const onDeleteConfirmed = () => {
    if (selectedLoan.current) {
      deleteLoanItem(selectedLoan.current.id);
    }
  };

  const onNewLoanCreated = () => {
    getLoanData();
    onShowNewLoanModal(false);
  };

  useEffect(() => {
    getLoanData();
  }, [getLoanData]);

  // Prep Bank data for select component
  const bankSelectItems = banks.map((bck) => ({
    value: bck.bank_name,
    label: bck.bank_name,
  }));

  return (
    <CoreLayout>
      <ToastContainer />
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
              <Button variant="outline-primary" onClick={onDownloadSeries}>
                <Icon icon={faFileCsv} className="mr-4" />
                Descargar
              </Button>
            </Toolbar>
          </div>
        </Row>
        <Row>
          <Col sm={12} md={8}>
            <Panel>
              <Chart chartHeight={600} noCard>
                <Chart.Bar
                  data={chartData}
                  color={PURPLE_COLOR_100}
                  scaleId="right"
                  title="Pago final (Derecho)"
                />
              </Chart>
              <CashFlowTable data={mergedCashFlows} />
            </Panel>
          </Col>
          <Col sm={12} md={4}>
            <Panel>
              <div
                style={{
                  display: 'flex',
                  padding: '15px 0',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <MultipleSelect
                  data={bankSelectItems}
                  onChange={onBankFilter}
                  placeholder="Selecciona Un Banco"
                />
                <Button
                  variant="primary"
                  onClick={() => onShowNewLoanModal(true)}
                >
                  <Icon icon={faMoneyBill} className="mr-4" />
                  Nuevo Crédito
                </Button>
              </div>
              <LoanList
                isLoading={loading}
                list={loans}
                onSelect={setSelectedLoans}
                onDelete={onDeleteLoan}
                onShowDetails={onShowDetailsLoan}
              />
            </Panel>
          </Col>
        </Row>
      </Container>
      <ConfirmationModal
        onCancel={() => onShowDeleteConfirm(false)}
        show={showDeleteConfirm}
        deleteText={DELETE_TXT}
        modalTitle={CONFIRM_MODAL_TITLE}
        onDelete={onDeleteConfirmed}
      />
      <LoanDetailsModal
        loan={selectedLoan.current}
        show={showLoanModal}
        onCancel={() => onShowLoanModal(false)}
      />
      <NewCreditModal
        show={showNewCreditModal}
        onLoanCreated={onNewLoanCreated}
        onShow={onShowNewLoanModal}
        bankList={banks}
      />
    </CoreLayout>
  );
}
