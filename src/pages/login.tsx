'use client';

import { NextPage } from 'next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser } from '@fortawesome/free-regular-svg-icons';
import { faLock } from '@fortawesome/free-solid-svg-icons';
import { Form, Carousel, InputGroup, Collapse } from 'react-bootstrap';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { deleteCookie, getCookie } from 'cookies-next';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import CandleSerieViewer from '@components/compare/candleViewer';
import { CandleSerie, TesYields } from '@models/tes';

import Button from '@components/Button';
import Col from '@components/UI/Col';
import Row from '@components/UI/Row';
import Container from '@components/UI/Container';
import Stack from '@components/UI/Stack';
import Image from '@components/UI/Image';
import Alert from '@components/UI/Alert';

import {
  Formik,
  ErrorMessage,
  FormikConfig,
  prepareDataForValidation,
} from 'formik';
import * as Yup from 'yup';

function LoginComponent() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [loginErrorMsg, setLoginErrorMsg] = useState('');
  const [newErrorLogin, setNewErrorLogin] = useState<boolean>(false);

  const signInSchema = Yup.object().shape({
    email: Yup.string().email('El email es invalid').required('Required'),
    password: Yup.string().min(1).required('Required'),
  });

  const initialValues = {
    email: '',
    password: '',
  };

  const getRedirect = () => {
    const redirect = getCookie('redirect');
    if (redirect) {
      deleteCookie('redirect');
      return redirect.toString();
    }

    return '/';
  };

  const onSubmit: FormikConfig<typeof initialValues>['onSubmit'] = async (
    formValues
  ) => {
    const preparedValues = signInSchema.cast(
      prepareDataForValidation(formValues)
    );
    setNewErrorLogin(false);
    const res = await supabase.auth.signInWithPassword(preparedValues);

    if (res.error) {
      setNewErrorLogin(true);
      setLoginErrorMsg(res.error.message);
    } else {
      setNewErrorLogin(false);
      router.push(getRedirect());
    }
  };

  return (
    <Formik
      initialValues={initialValues}
      onSubmit={onSubmit}
      validationSchema={signInSchema}
    >
      {({ values, handleChange, isSubmitting, handleSubmit }) => (
        <Form onSubmit={handleSubmit}>
          <Form.Group controlId="email">
            <InputGroup className="mb-3">
              <InputGroup.Text id="basic-addon3">
                <FontAwesomeIcon icon={faUser} fixedWidth />
              </InputGroup.Text>
              <Form.Control
                placeholder="Ingresa tu email"
                type="email"
                value={values.email}
                onChange={handleChange}
              />
            </InputGroup>
            <ErrorMessage name="email" component="div" />
          </Form.Group>

          <Form.Group controlId="password">
            <InputGroup className="mb-3">
              <InputGroup.Text id="basic-addon3">
                <FontAwesomeIcon icon={faLock} fixedWidth />
              </InputGroup.Text>
              <Form.Control
                placeholder="Ingresa tu password"
                type="password"
                value={values.password}
                onChange={handleChange}
              />
            </InputGroup>
            <ErrorMessage name="password" component="div" />
          </Form.Group>
          <Container fluid>
            <Row>
              <Col>
                <Button type="submit" disabled={isSubmitting}>
                  iniciar session
                </Button>
              </Col>
            </Row>
            <Collapse in={newErrorLogin}>
              <Row>
                <Col>
                  <Alert>{loginErrorMsg}</Alert>
                </Col>
              </Row>
            </Collapse>
          </Container>
        </Form>
      )}
    </Formik>
  );
}

function ChartComponent() {
  const supabase = createClientComponentClient();
  const [tesCandeSerie, setTESCandleSerie] = useState<CandleSerie>({
    name: '',
    values: [],
  });

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase.schema('public').rpc('tes_33');
      if (error) {
        setTESCandleSerie({ name: '', values: [] });
      } else if (data) {
        setTESCandleSerie({
          name: 'COLTES 13.25 09/02/33',
          values: data as TesYields[],
        });
      } else {
        setTESCandleSerie({ name: '', values: [] });
      }
    };

    fetchData();
  }, [supabase]);

  return (
    <Carousel>
      <Carousel.Item>
        <CandleSerieViewer
          candleSerie={tesCandeSerie}
          otherSeries={[]}
          fit
          shorten={false}
          normalyze={false}
          chartHeight="21rem"
          watermarkText="Xerenity"
        />
      </Carousel.Item>
      <Carousel.Item>
        <CandleSerieViewer
          candleSerie={tesCandeSerie}
          otherSeries={[]}
          fit
          shorten={false}
          normalyze={false}
          chartHeight="21rem"
          watermarkText="Xerenity"
        />
      </Carousel.Item>
    </Carousel>
  );
}

const Login: NextPage = () => (
  <div className="min-vh-100 d-flex align-items-center">
    <Container>
      <Row>
        <Col>
          <Stack>
            <Image
              src="/assets/img/brand/logo.svg"
              fluid
              width="230"
              alt="xerenity logo"
              className="mx-auto d-block"
            />
            <LoginComponent />
          </Stack>
        </Col>
        <Col>
          <ChartComponent />
        </Col>
      </Row>
    </Container>
  </div>
);

export default Login;
