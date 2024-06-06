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
  { display: 'UVR', value: 'uvr' },
];

const gracePeriods: { label: string; value: boolean }[] = [
  { label: 'Si', value: true },
  { label: 'No', value: false },
];

type FormValues = {
  start_date: string;
  number_of_payments: number;
  original_balance: string | undefined;
  periodicity: string;
  interest_rate: string;
  days_count: string;
  grace_type: string | undefined;
  grace_period: number | undefined;
  type: string;
  bank: string;
};

type FormActions = {
  setSubmitting: (val: boolean) => void;
};

type FormikSubmitHandler = (
  values: FormValues,
  actions: FormActions
) => Promise<void>;

const initialValues: FormValues = {
  start_date: '',
  number_of_payments: 12,
  original_balance: undefined,
  periodicity: '',
  interest_rate: '',
  days_count: '',
  grace_type: undefined,
  grace_period: undefined,
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

const NUM_PAYMENTS_TXT = 'Número de pagos';
const INTEREST_TXT = 'Interés nominal anual';

const NewCreditModal = ({
  showStart,
  createCallback,
  bankList,
  showCallBack,
}: NewCreditModalProps) => {
  const supabase = createClientComponentClient();
  const [show, setShow] = useState<boolean>(false);
  const [currentLoanType, setLoanType] = useState<
    string | 'fija' | 'ibr' | 'uvr'
  >(initialValues.type);
  const [hasGracePeriod, setGracePeriod] = useState<boolean>(false);

  useEffect(() => {
    setShow(showStart);
  }, [showStart]);

  const handleClose = () => {
    setShow(false);
    showCallBack(false);
  };

  const onFormSubmit: FormikSubmitHandler = async (
    values,
    { setSubmitting }
  ) => {
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
  };

  const getInterestLabel = (interest: string) => {
    const percentageVal = interest !== '' ? `${interest}%` : '';
    switch (currentLoanType) {
      case 'ibr':
        return `${INTEREST_TXT} ${percentageVal} + IBR`;
      case 'uvr':
        return `${INTEREST_TXT} ${percentageVal} * UVR`;
      default:
        // Text when 'fija' option is selected
        return `${INTEREST_TXT} ${percentageVal}`;
    }
  };

  return (
    <div>
      <Formik initialValues={initialValues} onSubmit={onFormSubmit}>
        {({
          values,
          handleChange,
          setFieldValue,
          handleSubmit,
          isSubmitting,
        }) => (
          <Modal size="lg" show={show} onHide={handleClose} centered>
            <Modal.Header closeButton>
              <Modal.Title>Crear Nuevo Crédito</Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleSubmit}>
              <Modal.Body>
                <Row className="pb-5">
                  <Form.Group controlId="type">
                    <Form.Label>Tipo de crédito</Form.Label>
                    <Row>
                      <Col>
                        {loanTypes?.map(({ display, value }) => [
                          <Form.Check
                            inline
                            label={display}
                            name="type"
                            checked={values.type === value}
                            onChange={() => {
                              setLoanType(value);
                              setFieldValue('type', value);
                            }}
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
                        {bankList?.map((bck) => (
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
                        {getInterestLabel(values.interest_rate)}
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
                <Row className="pb-5">
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
                    <Form.Group controlId="days_count">
                      <Form.Label>Conteo de días</Form.Label>
                      <Form.Select
                        value={values.days_count}
                        onChange={handleChange}
                      >
                        <option>Selecione un conteo</option>
                        <option value="por_dias_360">30/360</option>
                        <option value="por_dias_365">Act/365</option>
                        <option value="por_periodo">Por Periodo</option>
                      </Form.Select>
                      <ErrorMessage name="days_count" component="div" />
                    </Form.Group>
                  </Col>
                </Row>
                <Row className="pb-5">
                  <Form.Group controlId="number_of_payments">
                    <Form.Label>
                      {`${NUM_PAYMENTS_TXT} ${values.number_of_payments} ${nameMapping[values.periodicity] || ''}`}
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
                </Row>
                <Row className="pb-3">
                  <Form.Group controlId="has_grace_period">
                    <Form.Label>Tiene periodo de gracia</Form.Label>
                    <Row>
                      <Col>
                        {gracePeriods?.map(({ label, value }) => [
                          <Form.Check
                            inline
                            label={label}
                            name="has_grace_period"
                            checked={hasGracePeriod === value}
                            onChange={() => setGracePeriod(value)}
                            type="radio"
                            // value={values.grace_period}
                            key={`inline-grace-period-${value}`}
                          />,
                        ])}
                      </Col>
                    </Row>
                    <ErrorMessage name="type" component="div" />
                  </Form.Group>
                </Row>
                {hasGracePeriod && (
                  <Row className="pb-5">
                    <Col sm={12} md={6}>
                      <Form.Group controlId="grace_type">
                        <Form.Label>Tipo de gracia</Form.Label>
                        <Form.Select
                          value={values.grace_type}
                          onChange={handleChange}
                        >
                          <option>Selecione un tipo de gracia</option>
                          <option value="capital">Capital</option>
                          <option value="interes">Interés</option>
                          <option value="ambos">Capital e Interés</option>
                        </Form.Select>
                        <ErrorMessage name="grace_type" component="div" />
                      </Form.Group>
                    </Col>
                    <Col sm={12} md={6}>
                      <Form.Group controlId="grace_period">
                        <Form.Label>Periodos de gracia</Form.Label>
                        <Form.Control
                          placeholder="Introduce un número"
                          type="number"
                          value={values.grace_period}
                          onChange={handleChange}
                        />
                        <ErrorMessage name="grace_period" component="div" />
                      </Form.Group>
                    </Col>
                  </Row>
                )}
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
    </div>
  );
};

export default NewCreditModal;
