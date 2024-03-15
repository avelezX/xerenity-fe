import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser } from '@fortawesome/free-regular-svg-icons';
import { faLock } from '@fortawesome/free-solid-svg-icons';
import { Form, InputGroup, Collapse } from 'react-bootstrap';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { deleteCookie, getCookie } from 'cookies-next';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Button from '@components/UI/Button';
import Alert from '@components/UI/Alert';
import {
  Formik,
  ErrorMessage,
  FormikConfig,
  prepareDataForValidation,
} from 'formik';
import * as Yup from 'yup';

function LoginForm() {
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
        <div className="d-flex flex-column w-100 justify-content-center align-items-center py-5">
          <Form onSubmit={handleSubmit} className="w-50 d-flex flex-column">
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
            <div className="d-flex justify-content-center p-4">
              <Button type="submit" disabled={isSubmitting}>
                Iniciar Sesion
              </Button>
            </div>
            <Collapse in={newErrorLogin}>
              <div className="row">
                <div className="col">
                  <Alert>{loginErrorMsg}</Alert>
                </div>
              </div>
            </Collapse>
          </Form>
        </div>
      )}
    </Formik>
  );
}

export default LoginForm;
