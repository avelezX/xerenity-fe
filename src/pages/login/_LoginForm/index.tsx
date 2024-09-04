import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faLock, faUser } from '@fortawesome/free-solid-svg-icons';
import { InputGroup, Collapse } from 'react-bootstrap';
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
import Spinner from '@components/UI/Spinner';
import * as Yup from 'yup';
import strings from '../../../strings/login.json';
import ErrorMsg from '../_ErrorMsg';
import SendResetPasswordModal from '../_SendReset';
import LoginFormContainer from './LoginFormContainer.styled';

const { form } = strings;

function LoginForm() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [loginErrorMsg, setLoginErrorMsg] = useState('');
  const [newErrorLogin, setNewErrorLogin] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const signInSchema = Yup.object().shape({
    email: Yup.string().email(form.emailInvalid).required(form.required),
    password: Yup.string().min(1).required(form.required),
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
    const res = await supabase.auth.signInWithPassword({
      email: preparedValues.email,
      password: preparedValues.password,
    });

    if (res.error) {
      setNewErrorLogin(true);
      setLoginErrorMsg(res.error.message);
    } else {
      setNewErrorLogin(false);
      router.push(getRedirect());
    }
  };

  return (
    <>
      <Formik
        initialValues={initialValues}
        onSubmit={onSubmit}
        validationSchema={signInSchema}
      >
        {({ values, handleChange, isSubmitting, handleSubmit }) => (
          <LoginFormContainer onSubmit={handleSubmit}>
            <LoginFormContainer.Group controlId="email">
              <InputGroup>
                <InputGroup.Text className="bg-white">
                  <Icon className="text-primary" icon={faUser} fixedWidth />
                </InputGroup.Text>
                <LoginFormContainer.Control
                  placeholder={form.email}
                  type="email"
                  value={values.email}
                  onChange={handleChange}
                />
              </InputGroup>
              <ErrorMessage name="email">
                {(msg: string) => <ErrorMsg>{msg}</ErrorMsg>}
              </ErrorMessage>
            </LoginFormContainer.Group>
            <LoginFormContainer.Group controlId="password">
              <InputGroup>
                <InputGroup.Text className="bg-white">
                  <Icon className="text-primary" icon={faLock} fixedWidth />
                </InputGroup.Text>
                <LoginFormContainer.Control
                  placeholder={form.password}
                  type="password"
                  value={values.password}
                  onChange={handleChange}
                />
              </InputGroup>
              <ErrorMessage name="password">
                {(msg: string) => <ErrorMsg>{msg}</ErrorMsg>}
              </ErrorMessage>
            </LoginFormContainer.Group>
            <footer className="form-actions">
              <Button type="submit" disabled={isSubmitting}>
                {form.action}
                {isSubmitting && <Spinner size="sm" />}
              </Button>
              <a
                onClick={() => setShowResetModal(true)}
                href="#"
                className="link-primary link-underline-opacity-100-hover"
              >
                {form.forgot}
              </a>
            </footer>
            <Collapse in={newErrorLogin}>
              <div className="row">
                <div className="col">
                  <Alert>{loginErrorMsg}</Alert>
                </div>
              </div>
            </Collapse>
          </LoginFormContainer>
        )}
      </Formik>
      <SendResetPasswordModal
        onCancel={() => setShowResetModal(false)}
        show={showResetModal}
        modalTitle={form.reset}
      />
    </>
  );
}

export default LoginForm;
