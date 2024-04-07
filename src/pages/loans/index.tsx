'use client';

import React, { useCallback, useState, useEffect, ChangeEvent } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Container, Row, Col, Table, Button } from 'react-bootstrap';
import { Loan, LoanCashFlowIbr } from '@models/loans';
import Form from 'react-bootstrap/Form';
import ProgressBar from 'react-bootstrap/ProgressBar';

import { CoreLayout } from '@layout';
import {  LightSerieValue } from '@models/lightserie';
import LoanForm from '@components/forms/loanForm';
import { ExportToCsv, downloadBlob } from '@components/csvDownload/cscDownload';

import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrashCan } from '@fortawesome/free-regular-svg-icons';
import { 
faExclamation, 
faFileCsv,
faMoneyBill 
} from '@fortawesome/free-solid-svg-icons';
import SimpleModal from '@components/modals/genericModal';
import PriceTagTd from '@components/price/CopDisplay';

import ToolbarItem from '@components/UI/Toolbar/ToolbarItem';
import Toolbar from '@components/UI/Toolbar';
import tokens from 'design-tokens/tokens.json';
import Badge from '@components/UI/Badge';


import Chart from '@components/chart/Chart';

const designSystem = tokens.xerenity;
const PURPLE_COLOR_100 = designSystem['purple-100'].value;
const GREY_COLOR_300 = designSystem['gray-300'].value;


export default function NextPage() {
  const supabase = createClientComponentClient();

  const [allCredits, setAllCredits] = useState<Loan[]>();

  const [cashFlow, setCashFlow] = useState<LoanCashFlowIbr[]>();

  const [fetching, setFetching] = useState<boolean>(false);

  const [pagoCuotaSerie,setPagoCuotaSerie] = useState<LightSerieValue[]>([]);

  const [balanceSerie,setBalanceSerie] = useState<LightSerieValue[]>([]);

  const [showDialog, setShowDialog] = useState<boolean>(false);

  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  const [eraseLoan, setEraseLoan] = useState<string>('');

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

  const handleLoanCheckChnage = useCallback(
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
              rate_tot:au.rate_tot
            };
            newCashFlow.set(newentry.date, newentry);
          } else {
            newCashFlow.set(entr.date, entr);
          }
        });
      });

      const longCashFlow = new Array<LoanCashFlowIbr>();

      const balance: LightSerieValue[] = [];

      const payment: LightSerieValue[] = [];

      Array.from(newCashFlow.entries()).forEach((val) => {
        longCashFlow.push(val[1]);
      });

      longCashFlow.sort((a, b) => (a.date < b.date ? -1 : 1));

      longCashFlow.forEach((value) => {
        balance.push({
          time: value.date.split(' ')[0],
          value: value.ending_balance,
        });
        payment.push({
          time: value.date.split(' ')[0],
          value: value.payment,
        });
      });

      setPagoCuotaSerie(payment);     

      setBalanceSerie(balance);

      setCashFlow(longCashFlow);
    },
    [selectedLoans, setSelectLoans, calculateCashFlow, calculateCashFlowIbr]
  );

  const fetchLoanNames = useCallback(async () => {
    setShowDialog(false);

    const { data, error } = await supabase.schema('xerenity').rpc('get_loans');

    if (error) {
      setAllCredits([]);
      toast.error(error.message, { position: toast.POSITION.TOP_CENTER });
    } else if (data) {
      setAllCredits(data as Loan[]);
    } else {
      setAllCredits([]);
    }

  }, [supabase]);

  
  useEffect(() => {
    fetchLoanNames();
  }, [fetchLoanNames]);  


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
      fetchLoanNames();
    }
    setShowConfirm(false);
    setFetching(false);
  };  

  return (
    <CoreLayout>
      <LoanForm
        showStart={showDialog}
        createCallback={fetchLoanNames}
        showCallBack={setShowDialog}
      />
      <ToastContainer />
      <SimpleModal
        cancelCallback={() => setShowConfirm(false)}
        cancelMessage="Cancelar"
        saveCallback={() => borrarCredito(eraseLoan)}
        saveMessage="Borrar"
        title="Confirmar"
        message="Desea Borrar el credito"
        display={showConfirm}
        icon={faExclamation}
      />
      <Container fluid>

      <div className="row">
          <div className="col-xs-12 py-3">
            <Toolbar>
              <div className="section">
                  <ToolbarItem
                    className="py-3"
                    name='Nuevo Credito'
                    onClick={() => setShowDialog(!showDialog)}
                    icon={faMoneyBill}
                  />
                  <ToolbarItem
                    className="py-3"
                    name='Descargar'
                    onClick={downloadSeries}
                    icon={faFileCsv}
                  />                  
              </div>
            </Toolbar>
          </div>
        </div>

        <Row>
          <Col>
            <hr />
          </Col>
        </Row>
        <Row>
          <Col>
            <Table
              bordered
              hover
              responsive="sm"
              style={{ textAlign: 'center' }}
            >
              <thead>
                <tr>
                  <th>Fecha de inicio</th>
                  <th>Balance</th>
                  <th>Periodicidad</th>
                  <th>Numero de pagos</th>
                  <th>Interes</th>
                  <th>Tipo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {allCredits?.map((loan) => [
                  <tr key={`row-credit${loan.id}`}>
                    <td>{loan.start_date}</td>
                    <td>
                      {loan.original_balance.toLocaleString('us-US', {
                        style: 'currency',
                        currency: 'COP',
                      })}
                    </td>
                    <td>{loan.periodicity}</td>
                    <td>{loan.number_of_payments}</td>
                    <td>{loan.interest_rate}</td>
                    <td>
                      {loan.type === 'ibr' ? (
                        <Badge pill bg={PURPLE_COLOR_100}>
                          {loan.type}
                        </Badge>
                      ) : (
                        <Badge pill bg={GREY_COLOR_300}>
                          {loan.type}
                        </Badge>
                      )}
                    </td>
                    <td>
                      {' '}
                      <Row>
                        <Col sm={{ span: 3 }}>
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => {
                              setEraseLoan(loan.id);
                              setShowConfirm(true);
                            }}
                          >
                            <FontAwesomeIcon icon={faTrashCan} />
                          </Button>
                        </Col>
                        <Col sm={{ offset: 2, span: 3 }}>
                          <Form.Check
                            type="switch"
                            id={`check-${loan.id}`}
                            disabled={fetching}
                            onChange={(e) =>
                              handleLoanCheckChnage(e, loan.id, loan.type)
                            }
                          />
                        </Col>
                      </Row>
                    </td>
                  </tr>,
                ])}
              </tbody>
            </Table>
          </Col>
        </Row>

        <Row>
          <Col>
            <hr />
          </Col>
        </Row>

        <Row>
          <Col>
            <ProgressBar animated={fetching} now={100} />
          </Col>
        </Row>

        <Row>
          <Col>            
          {balanceSerie.length>0?(
            <Chart>
                <Chart.Bar
                    data={pagoCuotaSerie}
                    color={PURPLE_COLOR_100}
                    scaleId='rigth'
                    title='Pago final (Izquierdo)'
                />              
                <Chart.Line
                    data={balanceSerie}
                    color={GREY_COLOR_300}
                    scaleId='left'
                    title='Balance final (Izquierdo)'
                />                
            </Chart>
            ):(
              null
            )}
          </Col>
        </Row>

        <Row>
          <Col>
            <Table
              bordered
              hover
              responsive="sm"
              style={{ textAlign: 'center' }}
            >
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
                  <tr key={`row-credit${loan.date}`}>
                    <td>{loan.date.split(' ')[0]}</td>
                    <PriceTagTd value={loan.beginning_balance} />
                    <td>{loan.rate_tot?(loan.rate_tot.toFixed(2)):(loan.rate.toFixed(2))}%</td>
                    <PriceTagTd value={loan.payment} />
                    <td>{loan.interest.toFixed(2)}</td>
                    <td>{loan.principal.toFixed(2)}</td>
                    <PriceTagTd value={loan.ending_balance} />
                  </tr>,
                ])}
              </tbody>
            </Table>
          </Col>
        </Row>
      </Container>
    </CoreLayout>
  );
}
