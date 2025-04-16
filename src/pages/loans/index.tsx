'use client';

import React, { useEffect } from 'react';
import { Container, Row, Col, Form, InputGroup } from 'react-bootstrap';
import { CoreLayout } from '@layout';
import { ExportToCsv, downloadBlob } from 'src/utils/downloadCSV';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faCalendar,
  faDollar,
  faFileCsv,
  faPlus,
  faLandmark,
} from '@fortawesome/free-solid-svg-icons';
import Toolbar from '@components/UI/Toolbar';
import tokens from 'design-tokens/tokens.json';
import Chart from '@components/chart/Chart';
import Button from '@components/UI/Button';
import PageTitle from '@components/PageTitle';
import { MultiValue } from 'react-select';
import LoansTable from 'src/pages/loans/_LoansTable';
import MultipleSelect from '@components/UI/MultipleSelect';
import ConfirmationModal from '@components/UI/ConfirmationModal';
import useAppStore from '@store';
import Panel from '@components/Panel';
import { Loan } from 'src/types/loans';
import { SelectableRows } from 'src/types/selectableRows';
import { GenericCard, TableValue } from '@components/InforCard/InfoCard';
import DataTableBase from '@components/Table/BaseDataTable';
import LoanDebtListColumns from '@components/Table/columnDefinition/loans/loanDebt/columns';
import NewCreditModal from './_NewCreditModal';
import CashFlowOverlay from './_cashFlowOverLay/cashFlowOverlay';

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
    errorMessage,
    successMessage,
    deleteLoanItem,
    getLoanData,
    loans,
    mergedCashFlows,
    showDeleteConfirm,
    showNewLoanModal,
    showCashFlowTable,
    filterDate,
    currentSelection,
    setSelectedLoans,
    setSelectedBanks,
    onShowDeleteConfirm,
    onShowNewLoanModal,
    onShowCashFlowTable,
    resetStore,
    setFilterDate,
    loanDebtData,
    fullLoan,
  } = useAppStore();

  const cashflowsEmpty = mergedCashFlows.length === 0;

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

  const onDeleteConfirmed = () => {
    if (currentSelection) {
      deleteLoanItem(currentSelection.id);
    }
  };

  useEffect(() => {
    getLoanData();
    return () => resetStore(); // Reset when component unmount
  }, [getLoanData, resetStore]);

  useEffect(() => {
    if (errorMessage) {
      toast.error(errorMessage, {
        position: toast.POSITION.BOTTOM_RIGHT,
      });
    } else if (successMessage) {
      toast.success(successMessage, {
        position: toast.POSITION.BOTTOM_RIGHT,
      });
    }
  }, [errorMessage, successMessage]);

  // Prep Bank data for select component
  const bankSelectItems = banks.map((bck) => ({
    value: bck.bank_name,
    label: bck.bank_name,
  }));

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
              <Button
                variant="outline-primary"
                disabled={cashflowsEmpty}
                onClick={onDownloadSeries}
              >
                <Icon icon={faFileCsv} className="mr-4" />
                Descargar
              </Button>
              <Button
                variant={cashflowsEmpty ? 'outline-primary' : 'primary'}
                disabled={cashflowsEmpty}
                onClick={() => onShowCashFlowTable(true)}
              >
                <Icon icon={faDollar} className="mr-4" />
                Ver Flujos
              </Button>
              <Button
                variant="primary"
                onClick={() => onShowNewLoanModal(true)}
              >
                <Icon icon={faPlus} className="mr-4" />
                Nuevo Crédito
              </Button>
            </Toolbar>
          </div>
        </Row>
        <Row className="mb-3">
          <Col sm={3}>
            <GenericCard
              value={fullLoan?.average_irr}
              multi={100}
              name="WACC (IRR)"
              text="%"
            />
          </Col>
          <Col sm={3}>
            <GenericCard value={fullLoan?.average_tenor} name="Tenor (Años)" />
          </Col>
          <Col sm={3}>
            <GenericCard
              value={fullLoan?.average_duration}
              name="Duración (Años)"
              fixed={2}
            />
          </Col>
          <Col sm={3}>
            <GenericCard
              value={fullLoan?.loan_count}
              name="# Total de creditos"
              fixed={0}
            />
          </Col>
        </Row>
        <Row className="mb-3">
          <Col sm={8}>
            <Chart showToolbar>
              <Chart.Bar
                data={chartData}
                color={PURPLE_COLOR_100}
                scaleId="right"
                title="Pago final (Derecho)"
              />
            </Chart>
          </Col>
          <Col sm={4}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Calculo</th>
                  <th scope="col">IBR</th>
                  <th scope="col">Tasa Fija</th>
                  <th scope="col">Total</th>
                </tr>
              </thead>
              {fullLoan && (
                <tbody>
                  <tr>
                    <th scope="row">Valor deuda</th>
                    <TableValue value={fullLoan.total_value_ibr} fixed={0} />
                    <TableValue value={fullLoan?.total_value_fija} fixed={0} />
                    <TableValue value={fullLoan?.total_value} fixed={0} />
                  </tr>
                  <tr>
                    <th scope="row">WACC %</th>
                    <TableValue value={fullLoan?.average_irr_ibr} multi={100} />
                    <TableValue
                      value={fullLoan?.average_irr_fija}
                      multi={100}
                    />
                    <TableValue value={fullLoan?.average_irr} multi={100} />
                  </tr>
                  <tr>
                    <th scope="row">Tenor (Años)</th>
                    <TableValue value={fullLoan?.average_tenor} />
                    <TableValue value={fullLoan?.average_tenor} />
                    <TableValue value={fullLoan?.average_tenor} />
                  </tr>
                  <tr>
                    <th scope="row">Duracion (Años)</th>
                    <TableValue value={fullLoan?.average_duration} />
                    <TableValue value={fullLoan?.average_duration} />
                    <TableValue value={fullLoan?.average_duration} />
                  </tr>
                </tbody>
              )}
            </table>
          </Col>
        </Row>
        <Row>
          <Col sm={8}>
            <Panel>
              <Row>
                <Col sm={12} md={4}>
                  <MultipleSelect
                    data={bankSelectItems}
                    onChange={onBankFilter}
                    placeholder="Filtra tabla por banco"
                  />
                </Col>
                <Col sm={12} md={4} className="align-self-end">
                  <InputGroup>
                    <InputGroup.Text className="bg-white border-right-none">
                      <Icon
                        className="text-primary"
                        icon={faCalendar}
                        fixedWidth
                      />
                    </InputGroup.Text>
                    <Form.Control
                      type="date"
                      value={filterDate}
                      onChange={(a) => {
                        setFilterDate(a.target.value);
                      }}
                    />
                  </InputGroup>
                </Col>
              </Row>
              <LoansTable
                list={loans}
                onSelect={({
                  selectedCount,
                  selectedRows,
                }: SelectableRows<Loan>) => {
                  setSelectedLoans({
                    selectedCount,
                    selectedRows,
                    filterDate,
                  });
                }}
              />
            </Panel>
          </Col>
          <Col sm={4}>
            <Panel>
              <DataTableBase
                columns={LoanDebtListColumns}
                data={loanDebtData}
                fixedHeader
                selectableRowsNoSelectAll
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
      <NewCreditModal
        show={showNewLoanModal}
        onShow={onShowNewLoanModal}
        bankList={banks}
      />
      <CashFlowOverlay
        cashFlows={mergedCashFlows}
        handleShow={onShowCashFlowTable}
        show={showCashFlowTable}
      />
      <ToastContainer />
    </CoreLayout>
  );
}
