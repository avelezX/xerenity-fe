'use client'

import React,{ useCallback,useState,useEffect,ChangeEvent } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Container,Row,Col, Table, Button,Badge } from 'react-bootstrap'
import { Loan,LoanCashFlowIbr } from '@models/loans'
import Form from 'react-bootstrap/Form'
import ProgressBar from 'react-bootstrap/ProgressBar'
import CandleSerieViewer from '@components/compare/candleViewer'

import { AdminLayout } from '@layout'
import { LightSerie, defaultCustomFormat} from '@models/lightserie'
import LoanForm from '@components/forms/loanForm'
import { ExportToCsv,downloadBlob } from '@components/csvDownload/cscDownload'

import { ToastContainer, toast } from 'react-toastify'
import "react-toastify/dist/ReactToastify.css"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrashCan} from '@fortawesome/free-regular-svg-icons'
import { faExclamation } from '@fortawesome/free-solid-svg-icons'
import SimpleModal from '@components/modals/genericModal'
import PriceTagTd from '@components/price/CopDisplay'

export default function NextPage(){

    const supabase = createClientComponentClient()

    const [allCredits,setAllCredits] = useState<Loan[]>()

    const [cashFlow,setCashFlow] = useState<LoanCashFlowIbr[]>()

    const [fetching,setFetching] = useState<boolean>(false)

    const [cashFlowView,setCashFlowView] = useState<LightSerie[]>([])

    const [showDialog,setShowDialog]= useState<boolean>(false)

    const [showConfirm,setShowConfirm]= useState<boolean>(false)

    const [eraseLoan,setEraseLoan]= useState<string>('')

    const [selectedLoans,setSelectLoans] = useState<Map<string,LoanCashFlowIbr[]>>(new Map())
    

    const fetchLoanNames = useCallback( async () =>{        
        setShowDialog(false)
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

    const calculateCashFlow = useCallback(async (cred_id:string) => {
        
        setFetching(true)
        const {data,error} =   await supabase.schema('xerenity').rpc('loan_cash_flow',{credito_id:cred_id})
        if(error){            
            setFetching(false)
            toast.error(error.message, {position: toast.POSITION.TOP_CENTER})
            return []
        } 
        
        if(data){
            setFetching(false)
            return data as LoanCashFlowIbr[]
        }     

        setFetching(false)
        return []     
    },[supabase])

    const calculateCashFlowIbr = useCallback(async (cred_id:string) => {
        
        setFetching(true)
        const {data,error} =   await supabase.schema('xerenity').rpc('ibr_cash_flow',{credito_id:cred_id})
        if(error){            
            setFetching(false)
            toast.error(error.message, {position: toast.POSITION.TOP_CENTER})
            return []
        }
        
        if(data){
            setFetching(false)
            return data as LoanCashFlowIbr[]
        }    

        setFetching(false)
        return []     
    },[supabase])

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
        
        const {error} =   await supabase.schema('xerenity').rpc('erase_loan',{credito_id:cred_id})
        
        if(error){
            toast.error(error.message, {position: toast.POSITION.BOTTOM_RIGHT})
        }else{
            toast.info("El credito fue borrado exitosamente", {position: toast.POSITION.BOTTOM_RIGHT})
            fetchLoanNames()
        }
        setShowConfirm(false)
        setFetching(false)
     
    }
    
    const handleLoanCheckChnage = useCallback(async (event: ChangeEvent<HTMLInputElement>, loanId: string,loanType:string) => {
        
        const newSelection=new Map<string,LoanCashFlowIbr[]>()        

        Array.from(selectedLoans.entries()).forEach(([key,value])=>{
          newSelection.set(key,value)
        })

        if(event.target.checked){
            if(loanType==='fija'){
                newSelection.set(loanId,await calculateCashFlow(loanId))
            }else{
                newSelection.set(loanId,await calculateCashFlowIbr(loanId))
            }                
        }else{
            newSelection.delete(loanId)
        }

        setSelectLoans(newSelection)

        const newCashFlow= new Map<string,LoanCashFlowIbr>()
        
        Array.from(newSelection.entries()).forEach((val)=>{            
            val[1].forEach((entr)=>{
                const au=newCashFlow.get(entr.date)                
                if(au){
                    const newentry={
                        principal: au.principal + entr.principal,
                        rate: au.rate,
                        date: entr.date,
                        beginning_balance: au.beginning_balance + entr.beginning_balance,
                        payment: au.payment + entr.payment,
                        interest: au.payment + entr.payment,
                        ending_balance: au.ending_balance + entr.ending_balance
                    }                
                    newCashFlow.set(newentry.date,newentry)
                }else{
                    newCashFlow.set(entr.date,entr)
                }                
            })
        })

        const longCashFlow= new Array<LoanCashFlowIbr>()

        const balance: LightSerie={
            name: 'Balance final',
            color: '#FAC863',
            serie: [],
            type:'bar',
            priceFormat:defaultCustomFormat
        }

        const payment: LightSerie={
            name: 'Pago cuota',
            color: '#2270E2',
            serie: [],
            type:'line',
            priceFormat:defaultCustomFormat
        }

        Array.from(newCashFlow.entries()).forEach((val)=>{
            longCashFlow.push(val[1])
        })

        longCashFlow.sort((a, b) => (a.date < b.date ? -1 : 1))

        longCashFlow.forEach((value)=>{          
          balance.serie.push(
                {
                    time:value.date.split(' ')[0],
                    value:value.ending_balance
                }
            )
            payment.serie.push(
                {
                    time:value.date.split(' ')[0],
                    value:value.payment
                }
            )
        })

        setCashFlowView([balance,payment])

        setCashFlow(longCashFlow)
              
        
    },[selectedLoans,setSelectLoans,calculateCashFlow,calculateCashFlowIbr])

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
                        <Table bordered hover responsive='sm' style={{textAlign:'center'}}>
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
                                                {' '}
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
                                                            type="switch"
                                                            id={`check-${loan.id}`}
                                                            disabled={fetching}                                                            
                                                            onChange={(e)=> handleLoanCheckChnage(e, loan.id,loan.type)}
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
                        <CandleSerieViewer 
                            candleSerie={null} 
                            otherSeries={cashFlowView} 
                            fit
                            shorten
                            normalyze={false}
                            chartHeight="50rem"
                            watermarkText='Xerenity'
                        />
                    </Col>
                </Row>

                <Row>
                    <Col>
                    <Table bordered hover responsive='sm' style={{textAlign:'center'}}>
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
                                            
                                            <PriceTagTd value={loan.beginning_balance}/>
                                            
                                            <td>{loan.rate.toFixed(2)}%</td>                                            

                                            <PriceTagTd value={loan.payment}/>
                                            
                                            <td>{loan.interest.toFixed(2)}</td> 
                                            
                                            <td>{loan.principal.toFixed(2)}</td>                                            

                                            <PriceTagTd value={loan.ending_balance}/>
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