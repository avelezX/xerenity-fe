'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import React,{ useState,useEffect } from 'react'
import { Formik,ErrorMessage } from 'formik'
import {Form,Modal,Col,Row,Badge,Button} from 'react-bootstrap'

interface LoanFormProps{
    showStart:boolean;
    createCallback:() => void;
    showCallBack:(show:boolean) => void;
}

export default function LoanForm({showStart,createCallback,showCallBack}:LoanFormProps){

    const [show, setShow] = useState<boolean>(false)

    const handleClose = () => {
        setShow(false)
        showCallBack(false)
    }

    const supabase = createClientComponentClient()

    const initialValues=
    { 
        start_date: '',
        number_of_payments:12,
        original_balance:1,
        rate_type:1,
        periodicity:'',
        interest_rate:0.1
    }

    useEffect(() => {
        setShow(showStart)    
    },[showStart])


    return (

            <Formik
                initialValues={initialValues}                
                onSubmit={async (values, { setSubmitting }) => {
                    setSubmitting(true)                    
                    
                    const {data} = await supabase.schema('xerenity').rpc('create_credit',values)

                    if(data){
                        createCallback()                        
                    }
                    
                    setSubmitting(false)
                }}
                >
                {({
                    values,
                    //  errors,
                    //  touched,
                    handleChange,
                    //  handleBlur,
                    handleSubmit,
                    isSubmitting,
                    /* and other goodies */
                }) => (
                    <Modal show={show} onHide={handleClose}>
                        <Modal.Header closeButton>
                            <Modal.Title>Crear nuevo credito</Modal.Title>
                        </Modal.Header>
                        <Form onSubmit={handleSubmit}>
                            <Modal.Body>
                                <Form.Group  controlId="periodicity">
                                    <Form.Label>Periodicdad</Form.Label>
                                    <Form.Select value={values.periodicity} onChange={handleChange}>                                        
                                        <option>Selecione una periodicidad</option>
                                        <option value="Anual">Anual</option>
                                        <option value="Semestral">Semestral</option>
                                        <option value="Trimestral">Trimestral</option>
                                        <option value="Bimensual">Bimensual</option>
                                        <option value="Mensual">Mensual</option>
                                    </Form.Select>                                                                
                                    <ErrorMessage name='periodicity' component="div" />
                                </Form.Group>

                                <Form.Group  controlId="number_of_payments">
                                    <Form.Label>Numero de pagos</Form.Label>
                                    <Row>
                                        <Col sm={10}>
                                            <Form.Range 
                                                min={1}
                                                max={100}
                                                value={values.number_of_payments} 
                                                onChange={handleChange}
                                            />                                        
                                        </Col>
                                        <Col sm={1}>
                                            <Badge>
                                                {values.number_of_payments}
                                            </Badge>
                                        </Col>
                                    </Row>                            
                                    <ErrorMessage name='number_of_payments' component="div" />
                                </Form.Group>

                                <Form.Group  controlId="start_date">
                                    <Form.Label>Fecha de inicio</Form.Label>
                                    <Form.Control 
                                        type="date" 
                                        value={values.start_date} 
                                        onChange={handleChange}
                                    />                            
                                    <ErrorMessage name='start_date' component="div" />
                                </Form.Group>
                                
                                <Form.Group  controlId="original_balance">
                                    <Form.Label>Balance original</Form.Label>
                                    <Form.Control 
                                        type="number" 
                                        value={values.original_balance} 
                                        onChange={handleChange}
                                    />                            
                                    <ErrorMessage name='original_balance' component="div" />
                                </Form.Group>

                                <Form.Group  controlId="interest_rate">
                                    <Form.Label>Interes</Form.Label>
                                    <Form.Control 
                                        type="number" 
                                        value={values.interest_rate} 
                                        onChange={handleChange}
                                    />                            
                                    <ErrorMessage name='interest_rate' component="div" />
                                </Form.Group>

                            </Modal.Body>
                            <Modal.Footer>
                                <Button onClick={()=>setShow(false)} variant="secondary" disabled={isSubmitting}> 
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={isSubmitting}> 
                                    Guardar
                                </Button>
                            </Modal.Footer>
                        </Form>
                    </Modal>
                )}
    </Formik>

)
}
  
