import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faLock, faUser } from '@fortawesome/free-solid-svg-icons';
import { Form, InputGroup, Collapse } from 'react-bootstrap';
import { useRef, useState } from 'react';
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
import HCaptcha from '@hcaptcha/react-hcaptcha';
import strings from '../../../strings/login.json';
import ErrorMsg from '../_ErrorMsg';

const { form } = strings;

type LoginFormProps = {
  captchaKey: string;
};

function LoginForm({ captchaKey }: LoginFormProps) {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [loginErrorMsg, setLoginErrorMsg] = useState('');
  const [newErrorLogin, setNewErrorLogin] = useState<boolean>(false);
  const [captchaToken, setCaptchaToken] = useState<string | undefined>(
    undefined
  );
  const captcha = useRef<HCaptcha>(null);

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
      options: {
        captchaToken,
      },
    });

    if (res.error) {
      setNewErrorLogin(true);
      setLoginErrorMsg(res.error.message);
    } else {
      setNewErrorLogin(false);
      router.push(getRedirect());
    }

    if (captcha.current) {
      captcha.current.resetCaptcha();
      setCaptchaToken(undefined);
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
          <Form
            onSubmit={handleSubmit}
            className="w-50 d-flex justify-content-center flex-column gap-4"
          >
            <Form.Group controlId="email">
              <InputGroup>
                <InputGroup.Text className="bg-white">
                  <Icon className="text-primary" icon={faUser} fixedWidth />
                </InputGroup.Text>
                <Form.Control
                  placeholder={form.email}
                  type="email"
                  value={values.email}
                  onChange={handleChange}
                />
              </InputGroup>
              <ErrorMessage name="email">
                {(msg: string) => <ErrorMsg>{msg}</ErrorMsg>}
              </ErrorMessage>
            </Form.Group>
            <Form.Group controlId="password">
              <InputGroup>
                <InputGroup.Text className="bg-white">
                  <Icon className="text-primary" icon={faLock} fixedWidth />
                </InputGroup.Text>
                <Form.Control
                  placeholder={form.password}
                  type="password"
                  value={values.password}
                  onChange={handleChange}
                />
              </InputGroup>
              <ErrorMessage name="password">
                {(msg: string) => <ErrorMsg>{msg}</ErrorMsg>}
              </ErrorMessage>
            </Form.Group>
            <div className="d-flex justify-content-center">
              <HCaptcha
                languageOverride="es"
                ref={captcha}
                sitekey={captchaKey}
                onVerify={(token) => {
                  setCaptchaToken(token);
                }}
              />
            </div>
            <div className="d-flex justify-content-center">
              <Button type="submit" disabled={!captchaToken && !isSubmitting}>
                {form.action}
                {isSubmitting && <Spinner size="sm" />}
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
