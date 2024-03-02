'use client';

import { NextPage } from 'next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser } from '@fortawesome/free-regular-svg-icons';
import { faLock } from '@fortawesome/free-solid-svg-icons';
import {
  Button,
  Col,
  Container,
  Form,
  InputGroup,
  Row,
  Card,
  Collapse,
  Badge,
  Carousel,
  Image,
} from 'react-bootstrap';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { deleteCookie, getCookie } from 'cookies-next';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import CandleSerieViewer from '@components/compare/candleViewer';
import { CandleSerie, TesYields } from '@models/tes';
import App from 'ui-components/src/App';

interface MyFormData {
  username: string;
  password: string;
}

const Login: NextPage = () => {
  const router = useRouter();
  const [tesCandeSerie, setTESCandleSerie] = useState<CandleSerie>({
    name: '',
    values: [],
  });
  const [formData, setFormData] = useState<MyFormData>({
    username: '',
    password: '',
  });
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: value }));
  };
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<boolean>(false);
  const [loginErrorMsg, setLoginErrorMsg] = useState('');
  const supabase = createClientComponentClient();

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

  const getRedirect = () => {
    const redirect = getCookie('redirect');
    if (redirect) {
      deleteCookie('redirect');
      return redirect.toString();
    }

    return '/';
  };

  const login = async (e: React.FormEvent<HTMLFormElement>) => {
    e.stopPropagation();
    e.preventDefault();
    setSubmitting(true);

    const { username, password } = formData;

    const res = await supabase.auth.signInWithPassword({
      email: username,
      password,
    });

    if (res.error) {
      setLoginError(true);
      setLoginErrorMsg(res.error.message);
    } else {
      router.push(getRedirect());
    }
    setSubmitting(false);
  };

  return (
    <div className="bg-light min-vh-100 d-flex flex-row align-items-center dark:bg-transparent">
      <Container>
        <Row>
          <Col>
            <br />
          </Col>
        </Row>
        <Row>
          <Col>
            <Container>
              <Image
                src="/assets/img/xerenity/orgtrans.png"
                fluid
                style={{ width: '40%' }}
                alt="xerenity logo"
                className="mx-auto d-block"
              />
            </Container>
          </Col>
        </Row>
        <Row>
          <Col>
            <br />
          </Col>
        </Row>
        <Row>
          <Col sm={{ span: 6 }}>
            <Row>
              <Col className="bg-white border p-5">
                <div className="">
                  <h1>Login</h1>
                  <p className="text-black-50">Iniciar sesión en su cuenta</p>
                  <form onSubmit={login}>
                    <InputGroup className="mb-3">
                      <InputGroup.Text>
                        <FontAwesomeIcon icon={faUser} fixedWidth />
                      </InputGroup.Text>
                      <Form.Control
                        name="username"
                        required
                        disabled={submitting}
                        placeholder="Usuario"
                        aria-label="Username"
                        onChange={handleChange}
                      />
                    </InputGroup>
                    <InputGroup className="mb-3">
                      <InputGroup.Text>
                        <FontAwesomeIcon icon={faLock} fixedWidth />
                      </InputGroup.Text>
                      <Form.Control
                        type="password"
                        name="password"
                        required
                        disabled={submitting}
                        placeholder="Contrasena"
                        aria-label="Password"
                        onChange={handleChange}
                      />
                    </InputGroup>
                    <Row>
                      <Col>
                        <Collapse in={loginError}>
                          <Badge pill bg="danger" text="dark">
                            {loginErrorMsg}
                          </Badge>
                        </Collapse>
                      </Col>
                    </Row>
                    <Row>
                      <Col xs={6}>
                        <Button
                          className="px-4"
                          variant="primary"
                          type="submit"
                          disabled={submitting}
                        >
                          Login
                        </Button>
                      </Col>
                      <Col xs={6} className="text-end">
                        <Button className="px-0" variant="link" type="submit">
                          Forgot password?
                        </Button>
                      </Col>
                    </Row>
                  </form>
                </div>
              </Col>
            </Row>
          </Col>
          <Col sm={{ span: 6 }}>
            <Row>
              <Col>
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
                    <Carousel.Caption>
                      <h3>First slide label</h3>
                      <p>
                        Nulla vitae elit libero, a pharetra augue mollis
                        interdum.
                      </p>
                    </Carousel.Caption>
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
                    <Carousel.Caption>
                      <h3>Second slide label</h3>
                      <p>
                        Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                      </p>
                    </Carousel.Caption>
                  </Carousel.Item>
                </Carousel>
              </Col>
            </Row>
          </Col>
        </Row>
        <Row>
          <Col>
            <br />
            <br />
            <br />
            <br />
            <br />
          </Col>
        </Row>
        <Row>
          <Row>
            <Col sm={{ span: 6 }}>
              <Card>
                <Card.Body>
                  <Card.Title>Xerenity</Card.Title>
                  <Card.Text>
                    Es una empresa líder en servicios financieros dedicada a
                    proporcionar datos precisos y confiables y soluciones de
                    gestión de riesgos para empoderar a empresas e individuos a
                    tomar decisiones informadas.
                  </Card.Text>
                </Card.Body>
              </Card>
            </Col>
          </Row>
          <Row>
            <Col>
              <br />
            </Col>
          </Row>
          <Row>
            <Col sm={{ span: 6, offset: 6 }}>
              <Card>
                <Card.Body>
                  <Card.Title>Visión</Card.Title>
                  <Card.Text>
                    Ser la fuente líder de información financiera confiable,
                    empoderando a empresas e individuos para tomar decisiones
                    informadas y seguras.
                  </Card.Text>
                </Card.Body>
              </Card>
            </Col>
          </Row>
          <Row>
            <Col>
              <br />
            </Col>
          </Row>
          <Row>
            <Col sm={{ span: 6 }}>
              <Card>
                <Card.Body>
                  <Card.Title>Misión</Card.Title>
                  <Card.Text>
                    Facilitar el acceso a datos financieros precisos y
                    actualizados, proporcionando a nuestros usuarios las
                    herramientas necesarias para comprender y aprovechar las
                    dinámicas del mercado, impulsando así el éxito financiero.
                  </Card.Text>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Row>
        <Row>
          <App/>
        </Row>
      </Container>
    </div>
  );
};

export default Login;
