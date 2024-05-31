'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import React, { useState, useEffect } from 'react';
import { Formik, ErrorMessage } from 'formik';
import { Form, Modal, Col, Row, Button } from 'react-bootstrap';
import { NumericFormat } from 'react-number-format';
import { LoanType, Banks } from '@models/loans';
import { toast } from 'react-toastify';
import BalanceField from './BalanceField';

interface NewCreditModalProps {
  showStart: boolean;
  bankList: Banks[];
  createCallback: () => void;
  showCallBack: (show: boolean) => void;
}

const loanTypes: LoanType[] = [
  { display: 'Tasa Fija', value: 'fija' },
  { display: 'IBR', value: 'ibr' },
];

type FormValues = {
  start_date: string;
  number_of_payments: number;
  original_balance: string | undefined;
  periodicity: string;
  interest_rate: string;
  type: string;
  bank: string;
};

const initialValues: FormValues = {
  start_date: '',
  number_of_payments: 12,
  original_balance: undefined,
  periodicity: '',
  interest_rate: '',
  type: 'fija',
  bank: '',
};

const nameMapping: { [id: string]: string } = {
  Anual: 'Años',
  Semestral: 'Semestres',
  Trimestral: 'Trimestres',
  Bimensual: 'Bi meses',
  Mensual: 'Meses',
};

const NewCreditModal = ({
  showStart,
  createCallback,
  bankList,
  showCallBack,
}: NewCreditModalProps) => {
  const supabase = createClientComponentClient();
  const [show, setShow] = useState<boolean>(false);

  const handleClose = () => {
    setShow(false);
    showCallBack(false);
  };

  useEffect(() => {
    setShow(showStart);
  }, [showStart]);

  return (
    <Formik
      initialValues={initialValues}
      onSubmit={async (values, { setSubmitting }) => {
        setSubmitting(true);

        // Format original_balance back to number before sending values to DB
        const valuesCopy = {
          ...values,
          original_balance: values.original_balance
            ? Number(values.original_balance.split(',').join(''))
            : undefined,
        };

        const { data } = await supabase
          .schema('xerenity')
          .rpc('create_credit', valuesCopy);

        if (data) {
          toast.info('El credito fue creado exitosamente', {
            position: toast.POSITION.BOTTOM_RIGHT,
          });
          createCallback();
        }

        setSubmitting(false);
      }}
    >
      {({
        values,
        // errors,
        //  touched,
        handleChange,
        //  handleBlur,
        setFieldValue,
        handleSubmit,
        isSubmitting,
        /* and other goodies */
      }) => (
        <Modal size="lg" show={show} onHide={handleClose} centered>
          <Modal.Header closeButton>
            <Modal.Title>Crear Nuevo Crédito</Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleSubmit}>
            <Modal.Body>
              <Row className="pb-5">
                <Form.Group controlId="type">
                  <Form.Label>Tipo de credito</Form.Label>
                  <Row>
                    <Col>
                      {loanTypes.map(({ display, value }) => [
                        <Form.Check
                          inline
                          label={display}
                          name="type"
                          checked={values.type === value}
                          onChange={() => setFieldValue('type', value)}
                          type="radio"
                          value={values.type}
                          key={`inline-${value}-1`}
                        />,
                      ])}
                    </Col>
                  </Row>
                  <ErrorMessage name="type" component="div" />
                </Form.Group>
              </Row>
              <Row className="pb-5">
                <Col sm={12} md={6}>
                  <Form.Group controlId="bank">
                    <Form.Label>Entidad Banacaria</Form.Label>
                    <Form.Select value={values.bank} onChange={handleChange}>
                      <option>Selecione una periodicidad</option>
                      {bankList.map((bck) => (
                        <option
                          key={`select-opto-${bck.bank_name}`}
                          value={bck.bank_name}
                        >
                          {bck.bank_name}
                        </option>
                      ))}
                    </Form.Select>
                    <ErrorMessage name="bank" component="div" />
                  </Form.Group>
                </Col>
                <Col sm={12} md={6}>
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
                </Col>
              </Row>
              <Row className="pb-5">
                <Col sm={12} md={6}>
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
                </Col>
                <Col sm={12} md={6}>
                  <Form.Group controlId="start_date">
                    <Form.Label>Fecha de inicio</Form.Label>
                    <Form.Control
                      type="date"
                      value={values.start_date}
                      onChange={handleChange}
                    />
                    <ErrorMessage name="start_date" component="div" />
                  </Form.Group>
                </Col>
              </Row>
              <Row className="d-flex align-items-center">
                <Col sm={12} md={6}>
                  <Form.Group controlId="original_balance">
                    <Form.Label>Balance original</Form.Label>
                    <NumericFormat
                      thousandSeparator
                      value={values.original_balance}
                      placeholder="Añade un balance"
                      onValueChange={({ formattedValue }) => {
                        setFieldValue('original_balance', formattedValue);
                      }}
                      customInput={BalanceField}
                    />
                    <ErrorMessage name="original_balance" component="div" />
                  </Form.Group>
                </Col>
                <Col sm={12} md={6}>
                  <Form.Group controlId="number_of_payments">
                    <Form.Label>
                      Numero de pagos {values.number_of_payments}
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
                </Col>
              </Row>
            </Modal.Body>
            <Modal.Footer>
              <Button
                onClick={() => setShow(false)}
                variant="outline-primary"
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                Crear Crédito
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>
      )}
    </Formik>
  );
};

export default NewCreditModal;
