'use client';

import React, {
  useCallback,
  useState,
  useEffect,
  ChangeEvent,
  useRef,
} from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Container, Row, Table, Col } from 'react-bootstrap';
import { Loan, LoanCashFlowIbr, Banks } from '@models/loans';
import { CoreLayout } from '@layout';
import { LightSerieValue } from '@models/lightserie';
import LoanForm from '@components/forms/loanForm';
import { ExportToCsv, downloadBlob } from '@components/csvDownload/cscDownload';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faFileCsv,
  faMoneyBill,
  faLandmark,
} from '@fortawesome/free-solid-svg-icons';
import PriceTagTd from '@components/price/CopDisplay';
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
import LoanDetailsModal from './_LoanDetailsModal';

const designSystem = tokens.xerenity;
const PURPLE_COLOR_100 = designSystem['purple-100'].value;

const CONFIRM_MODAL_TITLE = '¿Desea Borrar Este Crédito?';
const DELETE_TXT =
  'Al proceder removera el crédito de la lista y todas sus configuraciones.';

export default function LoansPage() {
  const supabase = createClientComponentClient();

  const [allCredits, setAllCredits] = useState<Loan[]>();

  const [cashFlow, setCashFlow] = useState<LoanCashFlowIbr[]>();

  const [fetching, setFetching] = useState<boolean>(false);

  const [pagoCuotaSerie, setPagoCuotaSerie] = useState<LightSerieValue[]>([]);

  const [showDialog, setShowDialog] = useState<boolean>(false);

  const [showConfirm, setDeleteConfirm] = useState<boolean>(false);

  const [banks, setBanks] = useState<Banks[]>([]);

  const selectedLoan = useRef<Loan>();
  const selectedBanks = useRef<string[]>([]);

  const [showLoanModal, setShowLoanModal] = useState<boolean>(false);

  const [selectedLoans, setSelectLoans] = useState<
    Map<string, LoanCashFlowIbr[]>
  >(new Map());

  const calculateCashFlow = useCallback(
    async (cred_id: string) => {
      setFetching(true);
      const { data, error } = await supabase
        .schema('xerenity')
        .rpc('loan_cash_flow', { credito_id: cred_id });
      if (error) {
        setFetching(false);
        toast.error(error.message, { position: toast.POSITION.TOP_CENTER });
        return [];
      }

      if (data) {
        setFetching(false);
        return data as LoanCashFlowIbr[];
      }

      setFetching(false);
      return [];
    },
    [supabase]
  );

  const calculateCashFlowIbr = useCallback(
    async (cred_id: string) => {
      setFetching(true);
      const { data, error } = await supabase
        .schema('xerenity')
        .rpc('ibr_cash_flow', { credito_id: cred_id });
      if (error) {
        setFetching(false);
        toast.error(error.message, { position: toast.POSITION.TOP_CENTER });
        return [];
      }

      if (data) {
        setFetching(false);
        return data as LoanCashFlowIbr[];
      }

      setFetching(false);
      return [];
    },
    [supabase]
  );

  const downloadSeries = () => {
    const allValues: string[][] = [];
    allValues.push([
      'Fecha',
      'Balance Inicial',
      'Balance Final',
      'Interes',
      'Pago',
      'Principal',
    ]);
    if (cashFlow) {
      cashFlow.forEach((loa) => {
        allValues.push([
          loa.date,
          loa.beginning_balance.toString(),
          loa.ending_balance.toString(),
          loa.interest.toString(),
          loa.payment.toString(),
          loa.principal.toString(),
        ]);
      });
    }

    const csv = ExportToCsv(allValues);

    downloadBlob(csv, 'xerenity_flujo_de_caja.csv', 'text/csv;charset=utf-8;');
  };

  function calculatLoanCharts(newSelection: Map<string, LoanCashFlowIbr[]>) {
    const newCashFlow = new Map<string, LoanCashFlowIbr>();

    Array.from(newSelection.entries()).forEach((val) => {
      val[1].forEach((entr) => {
        const au = newCashFlow.get(entr.date);
        if (au) {
          const newentry = {
            principal: au.principal + entr.principal,
            rate: au.rate,
            date: entr.date,
            beginning_balance: au.beginning_balance + entr.beginning_balance,
            payment: au.payment + entr.payment,
            interest: au.payment + entr.payment,
            ending_balance: au.ending_balance + entr.ending_balance,
            rate_tot: au.rate_tot,
          };
          newCashFlow.set(newentry.date, newentry);
        } else {
          newCashFlow.set(entr.date, entr);
        }
      });
    });

    const longCashFlow = new Array<LoanCashFlowIbr>();

    const payment: LightSerieValue[] = [];

    Array.from(newCashFlow.entries()).forEach((val) => {
      longCashFlow.push(val[1]);
    });

    longCashFlow.sort((a, b) => (a.date < b.date ? -1 : 1));

    longCashFlow.forEach((value) => {
      payment.push({
        time: value.date.split(' ')[0],
        value: value.payment,
      });
    });

    setPagoCuotaSerie(payment);

    setCashFlow(longCashFlow);
  }

  const onLoanCheckChange = useCallback(
    async (
      event: ChangeEvent<HTMLInputElement>,
      loanId: string,
      loanType: string
    ) => {
      const newSelection = new Map<string, LoanCashFlowIbr[]>();

      Array.from(selectedLoans.entries()).forEach(([key, value]) => {
        newSelection.set(key, value);
      });

      if (event.target.checked) {
        if (loanType === 'fija') {
          newSelection.set(loanId, await calculateCashFlow(loanId));
        } else {
          newSelection.set(loanId, await calculateCashFlowIbr(loanId));
        }
      } else {
        newSelection.delete(loanId);
      }

      setSelectLoans(newSelection);

      calculatLoanCharts(newSelection);
    },
    [selectedLoans, setSelectLoans, calculateCashFlow, calculateCashFlowIbr]
  );

  const fetchLoans = useCallback(async () => {
    let filter: string[] = [];

    if (selectedBanks.current.length > 0) {
      filter = selectedBanks.current.map((bck) => bck);
    } else {
      filter = banks.map((bck) => bck.bank_name);
    }

    const { data, error } = await supabase
      .schema('xerenity')
      .rpc('get_loans', { bank_name_filter: filter });

    if (error) {
      setAllCredits([]);
      toast.error(error.message, { position: toast.POSITION.TOP_CENTER });
    } else if (data) {
      setAllCredits(data as Loan[]);
    } else {
      setAllCredits([]);
    }
    setShowDialog(false);
  }, [supabase, selectedBanks, banks]);

  const borrarCredito = async (cred_id: string) => {
    setFetching(true);

    const { error } = await supabase
      .schema('xerenity')
      .rpc('erase_loan', { credito_id: cred_id });

    if (error) {
      toast.error(error.message, { position: toast.POSITION.BOTTOM_RIGHT });
    } else {
      toast.info('El credito fue borrado exitosamente', {
        position: toast.POSITION.BOTTOM_RIGHT,
      });

      const newSelection = new Map<string, LoanCashFlowIbr[]>();

      Array.from(selectedLoans.entries()).forEach(([key, value]) => {
        if (key !== cred_id) {
          newSelection.set(key, value);
        }
      });

      setSelectLoans(newSelection);

      fetchLoans();

      calculatLoanCharts(newSelection);
    }
    setDeleteConfirm(false);
    setFetching(false);
  };

  const fetchInitLoans = useCallback(async () => {
    setFetching(true);
    const { data, error } = await supabase.schema('xerenity').rpc('get_banks');

    if (error) {
      toast.error(error.message, { position: toast.POSITION.TOP_CENTER });
    } else {
      const bankList = data as Banks[];

      setBanks(bankList);

      const response = await supabase.schema('xerenity').rpc('get_loans', {
        bank_name_filter: bankList.map((bck) => bck.bank_name),
      });

      if (response.error) {
        setAllCredits([]);
        toast.error(response.error.message, {
          position: toast.POSITION.TOP_CENTER,
        });
      } else if (data) {
        setAllCredits(response.data as Loan[]);
      } else {
        setAllCredits([]);
      }
    }
    setFetching(false);
  }, [supabase]);

  const handleOption = useCallback(
    async (selections: MultiValue<{ value: string; label: string }>) => {
      selectedBanks.current = selections?.map((sele) => sele.value);
      fetchLoans();
    },
    [selectedBanks, fetchLoans]
  );

  const onShowDetailsLoan = (loan: Loan) => {
    selectedLoan.current = loan;
    setShowLoanModal(true);
  };

  const onDeleteLoan = (loan: Loan) => {
    selectedLoan.current = loan;
    setDeleteConfirm(true);
  };

  const onDeleteConfirmed = () => {
    if (selectedLoan.current) {
      borrarCredito(selectedLoan.current.id);
    }
  };

  useEffect(() => {
    fetchInitLoans();
  }, [fetchInitLoans]);

  const bankSelectItems = banks.map((bck) => ({
    value: bck.bank_name,
    label: bck.bank_name,
  }));

  return (
    <CoreLayout>
      <LoanForm
        showStart={showDialog}
        createCallback={fetchLoans}
        showCallBack={setShowDialog}
        bankList={banks}
      />
      <ToastContainer />
      <Container fluid className="px-4 pb-3">
        <Row>
          <div className="d-flex align-items-center gap-2 py-1">
            <PageTitle>
              <Icon icon={faLandmark} size="1x" />
              <h4>Créditos</h4>
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
        <Row>
          <Col sm={12} md={8}>
            <Panel>
              <Chart chartHeight={600} noCard>
                <Chart.Bar
                  data={pagoCuotaSerie}
                  color={PURPLE_COLOR_100}
                  scaleId="right"
                  title="Pago final (Derecho)"
                />
              </Chart>
              {/* TODO: move to it's own component */}
              <div style={{ height: '800px', overflowY: 'scroll' }}>
                <Table hover responsive="sm">
                  <thead>
                    <tr>
                      <th>Fecha de inicio</th>
                      <th>Balance inicial</th>
                      <th>Tasa</th>
                      <th>Pago cuota</th>
                      <th>Intereses</th>
                      <th>Principal</th>
                      <th>Balance Final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashFlow?.map((loan) => [
                      <tr
                        key={`row-credit-${loan.date}-${loan.ending_balance}`}
                      >
                        <td>{loan.date.split(' ')[0]}</td>
                        <PriceTagTd value={loan.beginning_balance} />
                        <td>
                          {loan.rate_tot
                            ? loan.rate_tot.toFixed(2)
                            : loan.rate.toFixed(2)}
                          %
                        </td>
                        <PriceTagTd value={loan.payment} />
                        <td>{loan.interest.toFixed(2)}</td>
                        <td>{loan.principal.toFixed(2)}</td>
                        <PriceTagTd value={loan.ending_balance} />
                      </tr>,
                    ])}
                  </tbody>
                </Table>
              </div>
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
                  onChange={handleOption}
                  placeholder="Selecciona Un Banco"
                />
                <Button
                  variant="primary"
                  onClick={() => setShowDialog(!showDialog)}
                >
                  <Icon icon={faMoneyBill} className="mr-4" />
                  Nuevo Crédito
                </Button>
              </div>
              <LoanList
                isLoading={fetching}
                list={allCredits}
                selected={selectedLoans}
                onSelect={onLoanCheckChange}
                onDelete={onDeleteLoan}
                onShowDetails={onShowDetailsLoan}
              />
            </Panel>
          </Col>
        </Row>
      </Container>
      <ConfirmationModal
        onCancel={() => setDeleteConfirm(false)}
        show={showConfirm}
        deleteText={DELETE_TXT}
        modalTitle={CONFIRM_MODAL_TITLE}
        onDelete={onDeleteConfirmed}
      />
      <LoanDetailsModal
        loan={selectedLoan.current}
        show={showLoanModal}
        onCancel={() => setShowLoanModal(false)}
      />
    </CoreLayout>
  );
}
