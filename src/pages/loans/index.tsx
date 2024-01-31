'use client'

import React,{ ChangeEvent,useCallback,useState,useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Container,Row,Col, Table,Card, Button, Tooltip, ToastContainer } from 'react-bootstrap'
import { Loan,LoanCashFlow,LoanCashFlowIbr } from '@models/loans'
import Form from 'react-bootstrap/Form'
import ProgressBar from 'react-bootstrap/ProgressBar'
import CandleSerieViewer from '@components/compare/candleViewer'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'

import { AdminLayout } from '@layout'
import { LightSerie} from '@models/lightserie'
import LoanForm from '@components/forms/loanForm'
import { toast } from 'react-toastify'
import { ExportToCsv,downloadBlob } from '@components/csvDownload/cscDownload'


export default function NextPage(){

    const supabase = createClientComponentClient()

    const [allCredits,setAllCredits] = useState<Loan[]>()

    const [cashFlow,setCashFlow] = useState<LoanCashFlow[]>()

    const [fetching,setFetching] = useState<boolean>(false)

    const [loanIds,setLoanIds] = useState<string []>([])

    const [cashFlowView,setCashFlowView] = useState<LightSerie[]>([])

    const [showDialog,setShowDialog]= useState<boolean>(false)

    const fetchLoanNames = useCallback( async () =>{        

        const {data,error} =   await supabase.schema('xerenity').rpc('get_loans')

        if(error){
            setAllCredits([])
        }else if(data){            
            setAllCredits(data as Loan[])            
        }else{
            setAllCredits([])
        }

        setFetching(false)

    },[supabase]) 

    useEffect(()=>{
        fetchLoanNames()
    },[fetchLoanNames])

    const calculateCashFlow = async () => {
        
        setFetching(true)
        const {data,error} =   await supabase.schema('xerenity').rpc('loan_cash_flow',{credito_id:loanIds[0]})
        if(error){
            setCashFlow([])
            toast.error(error.message)
        }else if(data){
            const allData = data as LoanCashFlowIbr[]
            setCashFlow(allData)

            const balance: LightSerie={
                name: 'Balance',
                color: '#55933b',
                serie: []
            }

            const payment: LightSerie={
                name: 'Payment',
                color: '#2270E2',
                serie: []
            }

            allData.forEach((l)=>{
                balance.serie.push(
                    {
                        time:l.date.split(' ')[0],
                        value:l.ending_balance
                    }
                )
                payment.serie.push(
                    {
                        time:l.date.split(' ')[0],
                        value:l.payment
                    }
                )                
            })

            setCashFlowView([balance,payment])
            
        }else{
            setCashFlow([])
        }        

        setFetching(false)
     
    }

    const calculateCashFlowIbr = async () => {
        
        setFetching(true)
        const {data,error} =   await supabase.schema('xerenity').rpc('ibr_cash_flow',{credito_id:loanIds[0]})
        if(error){
            setCashFlow([])
            toast.error(error.message)
        }else if(data){
            const allData = data as LoanCashFlow[]
            setCashFlow(allData)

            const balance: LightSerie={
                name: 'Balance',
                color: '#55933b',
                serie: []
            }

            const payment: LightSerie={
                name: 'Payment',
                color: '#2270E2',
                serie: []
            }

            allData.forEach((l)=>{
                balance.serie.push(
                    {
                        time:l.date.split(' ')[0],
                        value:l.ending_balance
                    }
                )
                payment.serie.push(
                    {
                        time:l.date.split(' ')[0],
                        value:l.payment
                    }
                )
            })

            setCashFlowView([balance,payment])
            
        }else{
            setCashFlow([])
        }        

        setFetching(false)
     
    }    


    const selectLoan = async (event: ChangeEvent<HTMLInputElement>,cred_id:string) => {
        
        if(event.target.checked){            
            setLoanIds([...loanIds,cred_id])
        }else{
            const newLoanId=Array<string>()

            loanIds.forEach((lid)=>{
                if(lid !== cred_id){
                    newLoanId.push(lid)
                }
            })

            setLoanIds(newLoanId)
        }
    }

    const downloadSeries = () => {                
        const allValues: string[][]=[]
        allValues.push([
            'Fecha',
            'Balance Inicial',
            'Balance Final',
            'Interes',
            'Pago',
            'Principal'
        ]
        )
        if(cashFlow){
            cashFlow.forEach((loa)=>{
                allValues.push([
                    loa.date,
                    loa.beginning_balance.toString(),
                    loa.ending_balance.toString(),
                    loa.interest.toString(),
                    loa.payment.toString(),
                    loa.principal.toString(),

                ])
            })
        }        
  
        const csv=ExportToCsv(allValues)
  
        downloadBlob(csv, 'xerenity_flujo_de_caja.csv', 'text/csv;charset=utf-8;')
    }    

    return (        
        <AdminLayout >
            <LoanForm showStart={showDialog} createCallback={fetchLoanNames} showCallBack={setShowDialog}/>
            <ToastContainer />
            <Container fluid>
                <Row>
                    <Col sm={8}>
                        <h1>
                            Mis Creditos
                        </h1>
                    </Col>
                    <Col sm={{offset:2}}>
                        <Button onClick={()=>setShowDialog(!showDialog)}>
                            Crear Credito
                        </Button>
                    </Col>
                </Row>
                <Row>                    
                    <Col>
                        <Table bordered hover responsive='sm'>
                            <thead>
                                <tr>
                                    <th>Fecha de inicio</th>
                                    <th>Balance</th>
                                    <th>Periodicidad</th>
                                    <th>Numero de pagos</th>
                                    <th>Interes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {
                                    allCredits?.map((loan)=>[
                                        <tr key={`row-credit${loan.id}`}>
                                            <td>{loan.start_date}</td>
                                            <td>{loan.original_balance.toLocaleString('us-US', { style: 'currency', currency: 'COP' })}</td>
                                            <td>{loan.periodicity}</td>
                                            <td>{loan.number_of_payments}</td>
                                            <td>{loan.interest_rate}</td>
                                            <td>
                                                <Form.Check
                                                    type='switch'
                                                    id={`check-${loan.id}`}
                                                    label="Seleccionar"
                                                    onChange={(e)=> selectLoan(e, loan.id)}
                                                />
                                            </td>
                                        </tr>
                                    ])
                                }
                            </tbody>                    
                        </Table>                    
                    </Col>
                </Row>

                <Row>
                    <Col sm={4}>
                        <Card style={{ width: '18rem' }}>
                            <Card.Body>
                                <Card.Title>Flujo de Caja</Card.Title>
                                <Card.Text>
                                El Flujo de Caja permite tener una vista rápida del lugar en donde estamos pisando financieramente, dando luces de hacia dónde nos dirigimos en el corto, medio y largo plazo
                                </Card.Text>
                                <OverlayTrigger
                                    placement='right'
                                    overlay={                                        
                                        loanIds.length===0?(
                                            <Tooltip id="button-tooltip-2">Debes selecionar al menos un credito</Tooltip>
                                        ):
                                        (
                                            <Tooltip id="button-tooltip-2">Click para calcular</Tooltip>
                                        )
                                    }
                                >
                                    <Button className="d-inline-flex align-items-center"
                                        onClick={calculateCashFlow}disabled={loanIds.length===0}>Calcular
                                    </Button>
                                </OverlayTrigger>
                            </Card.Body>
                        </Card>                                
                    </Col>
                    <Col sm={4}>
                        <Card style={{ width: '18rem' }}>
                            <Card.Body>
                                <Card.Title>IBR cash flow</Card.Title>
                                <Card.Text>
                                Flujo de caja basado en curvas de inflacion
                                </Card.Text>
                                <OverlayTrigger
                                    placement='right'
                                    overlay={                                        
                                        loanIds.length===0?(
                                            <Tooltip id="button-tooltip-2">Debes selecionar al menos un credito</Tooltip>
                                        ):
                                        (
                                            <Tooltip id="button-tooltip-2">Click para calcular</Tooltip>
                                        )
                                    }
                                >
                                    <Button className="d-inline-flex align-items-center"
                                        onClick={calculateCashFlowIbr}disabled={loanIds.length===0}>Calcular
                                    </Button>
                                </OverlayTrigger>
                            </Card.Body>
                        </Card>                                
                    </Col>                    
                    <Col sm={4}>
                        <Card style={{ width: '18rem' }}>
                            <Card.Body>
                                <Card.Title>Exportar CSV</Card.Title>
                                <Card.Text>
                                 Descargar todo el flujo de caja a un archivo compatible con excel
                                </Card.Text>
                                <Button className="d-inline-flex align-items-center"
                                        onClick={downloadSeries} disabled={loanIds.length===0}>Calcular
                                </Button>
                            </Card.Body>
                        </Card>                                
                    </Col>                    
                </Row>

                <Row>
                    <Col>
                        <hr/>
                    </Col>
                </Row>

                <Row>
                    <Col>
                        <ProgressBar animated={fetching} now={100} />          
                    </Col>
                </Row>

                <Row>
                    <Col>
                        <CandleSerieViewer candleSerie={null} otherSeries={cashFlowView} 
                        fit 
                        shorten 
                        normalyze={false}
                        />
                    </Col>
                </Row>

                <Row>
                    <Col>
                    <Table bordered hover responsive='sm'>
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
                                {
                                    cashFlow?.map((loan)=>[
                                        <tr key={`row-credit${loan.date}`}>
                                            <td>{loan.date.split(' ')[0]}</td>
                                            <td>{loan.beginning_balance.toLocaleString('us-US', { style: 'currency', currency: 'COP' })}</td>
                                            <td>{loan.rate}</td>
                                            <td>{loan.payment.toLocaleString('us-US', { style: 'currency', currency: 'COP' })}</td>
                                            <td>{loan.interest}</td>
                                            <td>{loan.principal}</td>
                                            <td>{loan.ending_balance.toLocaleString('us-US', { style: 'currency', currency: 'COP' })}</td>
                                        </tr>
                                    ])
                                }
                            </tbody>                    
                        </Table>                                 
                    </Col>
                </Row>
            </Container>
        </AdminLayout>
    )
}