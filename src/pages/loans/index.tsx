'use client';

import React, { useCallback, useState, useEffect, ChangeEvent, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Container, Row, Col, Table } from 'react-bootstrap';
import { Loan, LoanCashFlowIbr,Banks } from '@models/loans';
import Form from 'react-bootstrap/Form';
import { CoreLayout } from '@layout';
import { LightSerieValue } from '@models/lightserie';
import LoanForm from '@components/forms/loanForm';
import { ExportToCsv, downloadBlob } from '@components/csvDownload/cscDownload';

import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faTrashCan } from '@fortawesome/free-regular-svg-icons';
import {
  faFileCsv,
  faMoneyBill,
  faLandmark,
} from '@fortawesome/free-solid-svg-icons';
import Modal from '@components/UI/Modal';
import PriceTagTd from '@components/price/CopDisplay';

import Toolbar from '@components/UI/Toolbar';
import tokens from 'design-tokens/tokens.json';
import Badge from '@components/UI/Badge';
import Chart from '@components/chart/Chart';
import Button from '@components/UI/Button';
import PageTitle from '@components/PageTitle';
import Select,{MultiValue} from "react-select";

const designSystem = tokens.xerenity;
const PURPLE_COLOR_100 = designSystem['purple-100'].value;
const GREY_COLOR_300 = designSystem['gray-300'].value;
const CONFIRMATION_TXT = 'Desea Borrar El Crédito?';
const MODAL_TITLE = 'Borrar Crédito';
const MODA_SAVE_TXT = 'Borrar';
const MODAL_CANCEL_TXT = 'Cancelar';


export default function NextPage() {
  const supabase = createClientComponentClient();

  const [allCredits, setAllCredits] = useState<Loan[]>();

  const [cashFlow, setCashFlow] = useState<LoanCashFlowIbr[]>();

  const [fetching, setFetching] = useState<boolean>(false);

  const [pagoCuotaSerie, setPagoCuotaSerie] = useState<LightSerieValue[]>([]);

  const [balanceSerie, setBalanceSerie] = useState<LightSerieValue[]>([]);

  const [showDialog, setShowDialog] = useState<boolean>(false);

  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  const [eraseLoan, setEraseLoan] = useState<string>('');

  const [banks,setBanks]= useState<Banks[]>([]);

  const selectedBanks=useRef<string[]>([]);

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

  function calculatLoanCharts(newSelection:Map<string, LoanCashFlowIbr[]>){
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
  }  

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

      calculatLoanCharts(newSelection);
    },
    [selectedLoans, setSelectLoans, calculateCashFlow, calculateCashFlowIbr]
  );


  const fetchLoans = useCallback(async () => {
    let filter:string[]=[];

    if(selectedBanks.current.length > 0){
      filter=selectedBanks.current.map((bck)=>(bck));
    }else{
      filter=banks.map((bck)=>(bck.bank_name));
    }

    const { data, error } = await supabase.schema('xerenity').rpc('get_loans',{'bank_name_filter':filter});
    
    if (error) {
      setAllCredits([]);
      toast.error(error.message, { position: toast.POSITION.TOP_CENTER });
    } else if (data) {
      setAllCredits(data as Loan[]);
    } else {
      setAllCredits([]);
    }
    setShowDialog(false);
  }, [supabase,selectedBanks,banks]);



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
        if(key !== cred_id){
          newSelection.set(key, value);
        }
        
      });
      
      setSelectLoans(newSelection);

      fetchLoans();

      calculatLoanCharts(newSelection);
    }
    setShowConfirm(false);
    setFetching(false);
  };

  const fetchInitLoans = useCallback(async () => {
    setFetching(true);
    const { data, error } = await supabase.schema('xerenity').rpc('get_banks');
    
    if(error){
      toast.error(error.message, { position: toast.POSITION.TOP_CENTER });
    }else{
      const bankList= data as Banks[];
      
      setBanks(bankList);
      
      const response = await supabase.schema('xerenity').rpc('get_loans',{'bank_name_filter':bankList.map((bck)=>(bck.bank_name))});
      
      if (response.error) {
        setAllCredits([]);
        toast.error(response.error.message, { position: toast.POSITION.TOP_CENTER });
      } else if (data) {
        setAllCredits(response.data as Loan[]);
      } else {
        setAllCredits([]);
      }
    }
    setFetching(false);

  }, [supabase]);

  const handleOption = useCallback(async (selections: MultiValue<{ value: string; label: string }>) => {
    selectedBanks.current=selections.map((sele)=>(sele.value));
    fetchLoans();
  }, [selectedBanks,fetchLoans]);

  useEffect(() => {
    fetchInitLoans();
    
  }, [fetchInitLoans]);  


  return (
    <CoreLayout>
      <LoanForm
        showStart={showDialog}
        createCallback={fetchLoans}
        showCallBack={setShowDialog}
        bankList={banks}
      />
      <ToastContainer />
      <Container fluid className="px-4">
        <Row>
          <div className="d-flex align-items-center gap-2 py-1">
            <PageTitle>
              <Icon icon={faLandmark} size="1x" />
              <h4>Creditos</h4>
            </PageTitle>
          </div>
        </Row>
        <Row>
          <div className="d-flex justify-content-end pb-3">
            <Toolbar>
                <Select 
                  isMulti 
                  options={banks.map((bck)=>({value:bck.bank_name,label:bck.bank_name}))} 
                  onChange={handleOption} 
                />           
                  <Button
                    variant="outline-primary"
                    onClick={() => setShowDialog(!showDialog)}
                  >
                <Icon icon={faMoneyBill} className="mr-4" />
                Nuevo Credito
              </Button>
              <Button variant="outline-primary" onClick={downloadSeries}>
                <Icon icon={faFileCsv} className="mr-4" />
                Descargar
              </Button>
            </Toolbar>
        </div>
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
                  <th>Entidad Bancaria</th>
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
                      {loan.bank}
                    </td>
                    <td>
                      {' '}
                      <Row>
                        <Col sm={{ span: 3 }}>
                          <Icon
                            icon={faTrashCan}
                            onClick={() => {
                              setEraseLoan(loan.id);
                              setShowConfirm(true);
                            }}
                          />
                        </Col>
                        <Col sm={{ offset: 2, span: 3 }}>
                          <Form.Check
                            type="switch"
                            checked={selectedLoans.has(loan.id)}
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
            <Chart chartHeight={800}>
              <Chart.Bar
                data={pagoCuotaSerie}
                color={PURPLE_COLOR_100}
                scaleId="rigth"
                title="Pago final (Derecho)"
              />
              <Chart.Line
                data={balanceSerie}
                color={GREY_COLOR_300}
                scaleId="left"
                title="Balance final (Izquierdo)"
              />
            </Chart>
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
          </Col>
        </Row>
      </Container>
      <Modal
        onCancel={() => setShowConfirm(false)}
        cancelText={MODAL_CANCEL_TXT}
        onSave={() => borrarCredito(eraseLoan)}
        saveText={MODA_SAVE_TXT}
        title={MODAL_TITLE}
        display={showConfirm}
      >
        {CONFIRMATION_TXT}
      </Modal>
    </CoreLayout>
  );
}
