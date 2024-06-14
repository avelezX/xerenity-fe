'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import React, { useState, useEffect } from 'react';
import { Formik, ErrorMessage, FormikValues } from 'formik';
import { Form, Modal, Col, Row, Button } from 'react-bootstrap';
import { NumericFormat } from 'react-number-format';
import { LoanType, Banks } from 'src/types/loans';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
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

const yesNoValues: { label: string; value: boolean }[] = [
  { label: 'Si', value: true },
  { label: 'No', value: false },
];

const loanSchema = Yup.object().shape({
  start_date: Yup.string().required('Fecha de incio es requerida'),
  number_of_payments: Yup.number().required('Numero de pagos es requerida'),
  original_balance: Yup.string(),
  periodicity: Yup.string().required('Periodicidad es requerida'),
  interest_rate: Yup.string().required('Tasa de interes es requerida'),
  days_count: Yup.string().required('El numero de dias es requerido'),
  grace_type: Yup.string(),
  grace_period: Yup.string(),
  type: Yup.string().required('El tip de credito es requrido'),
  bank: Yup.string().required('La entidad bancaria es requerida'),
  min_period_rate: Yup.number(),
});

const initialValues = {
  start_date: '',
  bank: '',
  number_of_payments: 12,
  original_balance: undefined,
  periodicity: '',
  interest_rate: '',
  type: 'fija',
  days_count: '',
  grace_type: undefined,
  grace_period: undefined,
  min_period_rate: undefined,
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

  const [hasMinRate, setHasMinRate] = useState<boolean>(false);

  useEffect(() => {
    setShow(showStart);
  }, [showStart]);

  const handleClose = () => {
    setShow(false);
    showCallBack(false);
  };

  const onFormSubmit = async (values: FormikValues) => {
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
      <Formik
        validationSchema={loanSchema}
        initialValues={initialValues}
        onSubmit={onFormSubmit}
      >
        {({
          values,
          handleChange,
          setFieldValue,
          handleSubmit,
          isSubmitting,
          touched,
          errors,
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
                        <option>Selecione una entidad bancaria</option>
                        {bankList?.map((bck) => (
                          <option
                            key={`select-opto-${bck.bank_name}`}
                            value={bck.bank_name}
                          >
                            {bck.bank_name}
                          </option>
                        ))}
                      </Form.Select>
                      {touched.bank && errors.bank && (
                        <ErrorMessage name="bank" component="div" />
                      )}
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
                      {touched.periodicity && errors.periodicity && (
                        <ErrorMessage name="periodicity" component="div" />
                      )}
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
                      {touched.interest_rate && errors.interest_rate && (
                        <ErrorMessage name="interest_rate" component="div" />
                      )}
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
                      {touched.start_date && errors.start_date && (
                        <ErrorMessage name="start_date" component="div" />
                      )}
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
                      {touched.original_balance && errors.original_balance && (
                        <ErrorMessage name="original_balance" component="div" />
                      )}
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
                      {touched.days_count && errors.days_count && (
                        <ErrorMessage name="days_count" component="div" />
                      )}
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
                    {touched.number_of_payments &&
                      errors.number_of_payments && (
                        <ErrorMessage
                          name="number_of_payments"
                          component="div"
                        />
                      )}
                  </Form.Group>
                </Row>
                <Row className="pb-3">
                  <Form.Group controlId="has_grace_period">
                    <Form.Label>¿Tiene periodo de gracia?</Form.Label>
                    <Row>
                      <Col>
                        {yesNoValues?.map(({ label, value }) => [
                          <Form.Check
                            inline
                            label={label}
                            name="has_grace_period"
                            checked={hasGracePeriod === value}
                            onChange={() => {
                              setFieldValue('grace_type', undefined);
                              setFieldValue('grace_period', undefined);
                              setGracePeriod(value);
                            }}
                            type="radio"
                            key={`inline-grace-period-${value}`}
                          />,
                        ])}
                      </Col>
                    </Row>
                    {touched.type && errors.type && (
                      <ErrorMessage name="type" component="div" />
                    )}
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
                        {touched.grace_type && errors.grace_type && (
                          <ErrorMessage name="grace_type" component="div" />
                        )}
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
                        {touched.grace_period && errors.grace_period && (
                          <ErrorMessage name="grace_type" component="div" />
                        )}
                      </Form.Group>
                    </Col>
                  </Row>
                )}
                <Row className="pb-3">
                  <Form.Group controlId="has_min_rate">
                    <Form.Label>¿Tiene tasa minima por periodo?</Form.Label>
                    <Row>
                      <Col>
                        {yesNoValues?.map(({ label, value }) => [
                          <Form.Check
                            inline
                            label={label}
                            name="has_min_rate"
                            checked={hasMinRate === value}
                            onChange={() => {
                              setFieldValue('min_period_rate', undefined);
                              setHasMinRate(value);
                            }}
                            type="radio"
                            key={`inline-min-rate-${value}`}
                          />,
                        ])}
                      </Col>
                    </Row>
                  </Form.Group>
                </Row>
                {hasMinRate && (
                  <Row className="pb-5">
                    <Col sm={12} md={6}>
                      <Form.Group controlId="min_period_rate">
                        <Form.Label>Mínima tasa por periodo</Form.Label>
                        <Form.Control
                          placeholder="10.0%"
                          value={values.min_period_rate}
                          onChange={handleChange}
                        />
                        {touched.min_period_rate && errors.min_period_rate && (
                          <ErrorMessage name="grace_type" component="div" />
                        )}
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
