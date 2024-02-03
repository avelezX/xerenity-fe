'use client'

import React,{ useCallback,useState,useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Container,Row,Col, Table, Button,Badge } from 'react-bootstrap'
import { Loan,LoanCashFlowIbr } from '@models/loans'
import Form from 'react-bootstrap/Form'
import ProgressBar from 'react-bootstrap/ProgressBar'
import CandleSerieViewer from '@components/compare/candleViewer'

import { AdminLayout } from '@layout'
import { LightSerie} from '@models/lightserie'
import LoanForm from '@components/forms/loanForm'
import { ExportToCsv,downloadBlob } from '@components/csvDownload/cscDownload'

import { ToastContainer, toast } from 'react-toastify'
import "react-toastify/dist/ReactToastify.css"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrashCan} from '@fortawesome/free-regular-svg-icons'
import { faExclamation } from '@fortawesome/free-solid-svg-icons'
import SimpleModal from '@components/modals/genericModal'

export default function NextPage(){

    const supabase = createClientComponentClient()

    const [allCredits,setAllCredits] = useState<Loan[]>()

    const [cashFlow,setCashFlow] = useState<LoanCashFlowIbr[]>()

    const [fetching,setFetching] = useState<boolean>(false)

    const [cashFlowView,setCashFlowView] = useState<LightSerie[]>([])

    const [showDialog,setShowDialog]= useState<boolean>(false)


    const [showConfirm,setShowConfirm]= useState<boolean>(false)

    const [eraseLoan,setEraseLoan]= useState<string>('')
    

    const fetchLoanNames = useCallback( async () =>{        

        setFetching(true)
        const {data,error} =   await supabase.schema('xerenity').rpc('get_loans')

        if(error){
            setAllCredits([])
            toast.error(error.message, {position: toast.POSITION.TOP_CENTER})
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

    const calculateCashFlow = async (cred_id:string) => {
        
        setFetching(true)
        const {data,error} =   await supabase.schema('xerenity').rpc('loan_cash_flow',{credito_id:cred_id})
        if(error){
            setCashFlow([])
            toast.error(error.message, {position: toast.POSITION.TOP_CENTER})
        }else if(data){
            const allData = data as LoanCashFlowIbr[]
            setCashFlow(allData)

            const balance: LightSerie={
                name: 'Balance',
                color: '#FAC863',
                serie: [],
                type:'bar'
            }

            const payment: LightSerie={
                name: 'Payment',
                color: '#2270E2',
                serie: [],
                type:'line'
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

    const calculateCashFlowIbr = async (cred_id:string) => {
        
        setFetching(true)
        const {data,error} =   await supabase.schema('xerenity').rpc('ibr_cash_flow',{credito_id:cred_id})
        if(error){
            setCashFlow([])            
            toast.error(error.message, {position: toast.POSITION.TOP_CENTER})
        }else if(data){
            const allData = data as LoanCashFlowIbr[]
            setCashFlow(allData)

            const balance: LightSerie={
                name: 'Balance',
                color: '#55933b',
                serie: [],
                type:'bar'
            }

            const payment: LightSerie={
                name: 'Payment',
                color: '#2270E2',
                serie: [],
                type:'line'
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


    const selectLoan = async (cred_id:string,cred_type:string) => {
        if(cred_type==='fija'){
            calculateCashFlow(cred_id)
        }else if(cred_type==='ibr'){
            calculateCashFlowIbr(cred_id)
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
    
    const borrarCredito = async (cred_id:string) => {
        
        setFetching(true)
        
        const {data,error} =   await supabase.schema('xerenity').rpc('erase_loan',{credito_id:cred_id})
        
        if(error){
            toast.error(error.message, {position: toast.POSITION.TOP_CENTER})
        }else{
            toast.info(data.message, {position: toast.POSITION.TOP_CENTER})
            fetchLoanNames()
        }
        setShowConfirm(false)
        setFetching(false)
     
    }    

    return (        
        <AdminLayout >
            <LoanForm showStart={showDialog} createCallback={fetchLoanNames} showCallBack={setShowDialog}/>
            <ToastContainer />
            <SimpleModal 
                cancelCallback={()=>setShowConfirm(false)} 
                cancelMessage='Cancelar'
                saveCallback={()=>borrarCredito(eraseLoan)} 
                saveMessage='Borrar'
                title='Confirmar'
                message='Desea Borrar el credito'
                display={showConfirm}
                icon={faExclamation}
            />
            <Container fluid>
                <Row>
                    <Col sm={8}>
                        <Row>
                            <Col>
                                <h1>
                                    Mis Creditos
                                </h1>
                            </Col>
                        </Row>
                    </Col>
                    <Col>
                        <Row>              
                            <Col >
                                <Button onClick={()=>setShowDialog(!showDialog)}>
                                    Nuevo credito
                                </Button>
                            </Col>
                            <Col >
                                <Button onClick={downloadSeries}>
                                    Exportar csv
                                </Button>
                            </Col>                    
                        </Row>
                    </Col>
                </Row>
                <Row>
                    <Col>
                        <hr/>
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
                                    <th>Tipo</th>
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
                                                {
                                                    loan.type==='ibr'?
                                                    (
                                                        <Badge pill bg="primary">{loan.type}</Badge>
                                                    )
                                                    :
                                                    (
                                                        <Badge pill bg="warning">{loan.type}</Badge>
                                                    )
                                                }
                                            </td>
                                            <td>
                                                <Row>

                                                    <Col sm={{span:3}}>
                                                        <Button size='sm' variant="outline-danger" onClick={                                                                
                                                                ()=>{
                                                                    setEraseLoan(loan.id)
                                                                    setShowConfirm(true)
                                                                }
                                                            }>
                                                            <FontAwesomeIcon icon={faTrashCan}/>
                                                        </Button>
                                                    </Col>
                                                    <Col sm={{offset:2,span:3}}>
                                                        <Form.Check
                                                            type='radio'
                                                            id={`check-${loan.id}`}
                                                            name="selectedcredit"
                                                            disabled={fetching}
                                                            label="Ver"
                                                            onClick={()=>selectLoan(loan.id,loan.type)}
                                                        />
                                                    </Col>
                                                </Row>
                                            </td>
                                        </tr>
                                    ])
                                }
                            </tbody>                    
                        </Table>                    
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