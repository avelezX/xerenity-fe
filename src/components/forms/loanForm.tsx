'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import React, { useState, useEffect } from 'react';
import { Formik, ErrorMessage } from 'formik';
import { Form, Modal, Col, Row, Button, Alert } from 'react-bootstrap';
import { LoanType,Banks } from '@models/loans';

interface LoanFormProps {
  showStart: boolean;
  bankList:Banks[];
  createCallback: () => void;
  showCallBack: (show: boolean) => void;
}

const loanTypes: LoanType[] = [
  { display: 'Tasa Fija', value: 'fija' },
  { display: 'IBR', value: 'ibr' },
];

export default function LoanForm({
  showStart,
  createCallback,
  bankList,
  showCallBack,
}: LoanFormProps) {
  const [show, setShow] = useState<boolean>(false);

  const handleClose = () => {
    setShow(false);
    showCallBack(false);
  };

  const supabase = createClientComponentClient();

  const initialValues = {
    start_date: '',
    number_of_payments: 12,
    original_balance: 0,
    periodicity: '',
    interest_rate: '',
    type: 'fija',
    bank:''
  };

  useEffect(() => {
    setShow(showStart);
  }, [showStart]);

  const nameMapping: { [id: string]: string } = {
    Anual: 'Anos',
    Semestral: 'Semestres',
    Trimestral: 'Trimestres',
    Bimensual: 'Bi meses',
    Mensual: 'Meses',
  };

  return (
    <Formik
      initialValues={initialValues}
      onSubmit={async (values, { setSubmitting }) => {
        setSubmitting(true);

        const { data } = await supabase
          .schema('xerenity')
          .rpc('create_credit', values);

        if (data) {
          createCallback();
        }

        setSubmitting(false);
      }}
    >
      {({
        values,
        //  errors,
        //  touched,
        handleChange,
        //  handleBlur,
        setFieldValue,
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
              <Alert variant="light">
                <Form.Group controlId="type">
                  <Form.Label>Tipo de credito</Form.Label>
                  <Row>
                    <Col>
                      {loanTypes.map((loant) => [
                        <Form.Check
                          inline
                          label={loant.display}
                          name="type"
                          checked={values.type === loant.value}
                          onChange={() => setFieldValue('type', loant.value)}
                          type="radio"
                          value={values.type}
                          key={`inline-${loant}-1`}
                        />,
                      ])}
                    </Col>
                  </Row>
                  <ErrorMessage name="type" component="div" />
                </Form.Group>
              </Alert>

              <Alert variant="light">
                <Form.Group controlId="periodicity">
                  <Form.Label>Periodicdad</Form.Label>
                  <Form.Select
                    value={values.periodicity}
                    onChange={handleChange}
                  >
                    <option>Selecione una periodicidad</option>
                    <option value="Anual">Anual</option>
                    <option value="Semestral">Semestral</option>
                    <option value="Trimestral">Trimestral</option>
                    <option value="Bimensual">Bimensual</option>
                    <option value="Mensual">Mensual</option>
                  </Form.Select>
                  <ErrorMessage name="periodicity" component="div" />
                </Form.Group>
              </Alert>

              <Alert variant="light">
                <Form.Group controlId="bank">
                  <Form.Label>Entidad Banacaria</Form.Label>
                  <Form.Select
                    value={values.bank}
                    onChange={handleChange}
                  >
                    <option>Selecione una periodicidad</option>
                    {bankList.map((bck)=>(
                      <option key={`select-opto-${bck.bank_name}`} value={bck.bank_name}>{bck.bank_name}</option>
                    ))}
                  </Form.Select>
                  <ErrorMessage name="bank" component="div" />
                </Form.Group>
              </Alert>              

              <Alert variant="light">
                <Form.Group controlId="number_of_payments">
                  <Form.Label>
                    Numero de pagos {values.number_of_payments}{' '}
                    {nameMapping[values.periodicity]}
                  </Form.Label>
                  <Row>
                    <Col>
                      <Form.Range
                        min={1}
                        max={100}
                        value={values.number_of_payments}
                        onChange={handleChange}
                      />
                    </Col>
                  </Row>
                  <ErrorMessage name="number_of_payments" component="div" />
                </Form.Group>
              </Alert>

              <Alert variant="light">
                <Form.Group controlId="start_date">
                  <Form.Label>Fecha de inicio</Form.Label>
                  <Form.Control
                    type="date"
                    value={values.start_date}
                    onChange={handleChange}
                  />
                  <ErrorMessage name="start_date" component="div" />
                </Form.Group>
              </Alert>

              <Alert variant="light">
                <Form.Group controlId="original_balance">
                  <Form.Label>Balance original</Form.Label>

                  <Form.Control
                    type="number"
                    value={values.original_balance}
                    onChange={handleChange}
                  />
                  <ErrorMessage name="original_balance" component="div" />
                </Form.Group>
              </Alert>

              <Alert variant="light">
                <Form.Group controlId="interest_rate">
                  <Form.Label>
                    Interes nominal anual {values.interest_rate}%
                  </Form.Label>
                  <Form.Control
                    placeholder="10.0%"
                    type="number"
                    value={values.interest_rate}
                    onChange={handleChange}
                  />
                  <ErrorMessage name="interest_rate" component="div" />
                </Form.Group>
              </Alert>
            </Modal.Body>

            <Modal.Footer>
              <Button
                onClick={() => setShow(false)}
                variant="secondary"
                disabled={isSubmitting}
              >
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
  );
}
