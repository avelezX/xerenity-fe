'use client';

import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { Image, Form, InputGroup } from 'react-bootstrap';
import {
  Formik,
  ErrorMessage,
  FormikConfig,
  prepareDataForValidation,
} from 'formik';
import { faEye, faEyeSlash, faLock } from '@fortawesome/free-solid-svg-icons';
import Button from '@components/UI/Button';
import Spinner from '@components/UI/Spinner';
import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import IconButton from '@components/UI/IconButton';

import * as Yup from 'yup';
import Alert from '@components/UI/Alert';
import strings from '../../../strings/resetPassword.json';
import PoweredBy from '../_PoweredBy';
import ErrorMsg from '../_ErrorMsg';

const { form } = strings;

const LOGO_SETTINGS = {
  url: '/assets/img/brand/logo.svg',
  width: '400',
  alt: 'xerenity logo',
};

function ResetPasswordPage() {
  const supabase = createClientComponentClient();
  const [message, setMessage] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(true);

  const resetPasswordSchema = Yup.object().shape({
    password: Yup.string().min(10).required(form.required),
    confirmPassword: Yup.string().min(10).required(form.required),
  });

  const initialValues = {
    password: '',
    confirmPassword: '',
  };

  const onSubmit: FormikConfig<typeof initialValues>['onSubmit'] = async (
    formValues
  ) => {
    const preparedValues = resetPasswordSchema.cast(
      prepareDataForValidation(formValues)
    );

    const { data, error } = await supabase.auth.updateUser({
      password: preparedValues.confirmPassword,
    });

    if (error) {
      setMessage(error.message);
    } else if (data) {
      setMessage(form.check);
    }
  };

  return (
    <div className="container-fluid w-50 h-90">
      <div className=" row min-vh-100">
        <div className="bg-white min-vh-100 d-flex flex-column justify-content-between">
          <Image
            src={LOGO_SETTINGS.url}
            fluid
            draggable="false"
            width={LOGO_SETTINGS.width}
            alt={LOGO_SETTINGS.alt}
            className="mx-auto d-block pb-3"
          />
          <Formik
            initialValues={initialValues}
            onSubmit={onSubmit}
            validationSchema={resetPasswordSchema}
            validate={(values) => {
              if (values.password !== values.confirmPassword) {
                return {
                  confirmPassword: form.noigual,
                };
              }
              return {};
            }}
          >
            {({ values, handleChange, isSubmitting, handleSubmit }) => (
              <Form
                onSubmit={handleSubmit}
                className="d-flex justify-content-center flex-column gap-3"
              >
                <Form.Group controlId="password">
                  <InputGroup>
                    <InputGroup.Text className="bg-white">
                      <Icon className="text-primary" icon={faLock} fixedWidth />
                    </InputGroup.Text>
                    <Form.Control
                      placeholder={form.password}
                      type={showPassword ? 'text' : 'password'}
                      value={values.password}
                      onChange={handleChange}
                    />
                  </InputGroup>
                  <ErrorMessage name="password">
                    {(msg: string) => <ErrorMsg>{msg}</ErrorMsg>}
                  </ErrorMessage>
                </Form.Group>
                <Form.Group controlId="confirmPassword">
                  <InputGroup>
                    <InputGroup.Text className="bg-white">
                      <Icon className="text-primary" icon={faLock} fixedWidth />
                    </InputGroup.Text>
                    <Form.Control
                      placeholder={form.confirma}
                      type={showPassword ? 'text' : 'password'}
                      value={values.confirmPassword}
                      onChange={handleChange}
                    />
                  </InputGroup>
                  <ErrorMessage name="confirmPassword">
                    {(msg: string) => <ErrorMsg>{msg}</ErrorMsg>}
                  </ErrorMessage>
                </Form.Group>
                <div className="d-flex justify-content-end gap-4">
                  <IconButton onClick={() => setShowPassword(!showPassword)}>
                    <Icon
                      className="text-primary"
                      icon={showPassword ? faEye : faEyeSlash}
                      fixedWidth
                    />
                  </IconButton>
                  <Button type="submit">
                    {form.action}
                    {isSubmitting && <Spinner size="sm" />}
                  </Button>
                </div>
              </Form>
            )}
          </Formik>
          {message && <Alert>{message}</Alert>}

          <PoweredBy />
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordPage;
