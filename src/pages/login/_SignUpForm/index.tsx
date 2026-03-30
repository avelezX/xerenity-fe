import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faEnvelope,
  faLock,
  faUser,
  faEarthAmericas,
  faBuilding,
} from '@fortawesome/free-solid-svg-icons';
import { InputGroup, Collapse } from 'react-bootstrap';
import { useState } from 'react';
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
import styled from 'styled-components';
import strings from '../../../strings/signup.json';
import ErrorMsg from '../_ErrorMsg';
import countries from '../../../strings/countries.json';
import SignFormContainer from './SignFormContainer.styled';

const { form } = strings;

const AccountTypeToggle = styled.div`
  display: flex;
  gap: 0;
  margin-bottom: 4px;
  border: 1px solid #dedede;
  border-radius: 8px;
  overflow: hidden;
  width: 100%;

  button {
    flex: 1;
    padding: 10px 16px;
    border: none;
    background: white;
    font-size: 13px;
    font-weight: 500;
    color: #8e8e8e;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.2s;

    &.active {
      background: #302b63;
      color: white;
    }
  }
`;

function SingUpForm() {
  const supabase = createClientComponentClient();
  const [signUpMsg, setSignUpMsg] = useState('');
  const [newSignUpAction, setNewSignUpAction] = useState<boolean>(false);

  const signUpSchema = Yup.object().shape({
    email: Yup.string().email(form.emailInvalid).required(form.required),
    password: Yup.string().min(10).required(form.required),
    name: Yup.string().min(2).required(form.required),
    country: Yup.string().min(2).required(form.required),
    accountType: Yup.string()
      .oneOf(['individual', 'corporate'])
      .required(form.required),
  });

  const initialValues = {
    email: '',
    password: '',
    name: '',
    country: 'CO',
    accountType: 'individual' as 'individual' | 'corporate',
  };

  const onSubmit: FormikConfig<typeof initialValues>['onSubmit'] = async (
    formValues
  ) => {
    const preparedValues = signUpSchema.cast(
      prepareDataForValidation(formValues)
    );

    setNewSignUpAction(false);
    const res = await supabase.auth.signUp({
      email: preparedValues.email,
      password: preparedValues.password,
      options: {
        emailRedirectTo: 'https://xerenity.vercel.app/auth/callback',
        data: {
          full_name: preparedValues.name,
          country: preparedValues.country,
          account_type: preparedValues.accountType,
        },
      },
    });

    if (res.error) {
      setSignUpMsg(res.error.message);
    } else {
      setSignUpMsg(form.confirmacion);
    }
    setNewSignUpAction(true);
  };

  return (
    <Formik
      initialValues={initialValues}
      onSubmit={onSubmit}
      validationSchema={signUpSchema}
    >
      {({ values, handleChange, isSubmitting, handleSubmit, setFieldValue }) => (
        <SignFormContainer onSubmit={handleSubmit}>
          <SignFormContainer.Group controlId="email">
            <InputGroup>
              <InputGroup.Text className="bg-white border-right-none">
                <Icon className="text-primary" icon={faEnvelope} fixedWidth />
              </InputGroup.Text>
              <SignFormContainer.Control
                placeholder={form.email}
                type="email"
                value={values.email}
                onChange={handleChange}
              />
            </InputGroup>
            <ErrorMessage name="email">
              {(msg: string) => <ErrorMsg>{msg}</ErrorMsg>}
            </ErrorMessage>
          </SignFormContainer.Group>

          <SignFormContainer.Group controlId="password">
            <InputGroup>
              <InputGroup.Text className="bg-white">
                <Icon className="text-primary" icon={faLock} fixedWidth />
              </InputGroup.Text>
              <SignFormContainer.Control
                placeholder={form.password}
                type="password"
                value={values.password}
                onChange={handleChange}
              />
            </InputGroup>
            <ErrorMessage name="password">
              {(msg: string) => <ErrorMsg>{msg}</ErrorMsg>}
            </ErrorMessage>
          </SignFormContainer.Group>

          <SignFormContainer.Group controlId="name">
            <InputGroup>
              <InputGroup.Text className="bg-white">
                <Icon className="text-primary" icon={faUser} fixedWidth />
              </InputGroup.Text>
              <SignFormContainer.Control
                placeholder={form.nombre}
                type="text"
                value={values.name}
                onChange={handleChange}
              />
            </InputGroup>
            <ErrorMessage name="name">
              {(msg: string) => <ErrorMsg>{msg}</ErrorMsg>}
            </ErrorMessage>
          </SignFormContainer.Group>

          <SignFormContainer.Group controlId="country">
            <InputGroup>
              <InputGroup.Text className="bg-white">
                <Icon
                  className="text-primary"
                  icon={faEarthAmericas}
                  fixedWidth
                />
              </InputGroup.Text>
              <SignFormContainer.Select
                value={values.country}
                onChange={handleChange}
              >
                {countries.map((cty) => (
                  <option key={cty.code} value={cty.code}>
                    {cty.name}
                  </option>
                ))}
              </SignFormContainer.Select>
            </InputGroup>
            <ErrorMessage name="country">
              {(msg: string) => <ErrorMsg>{msg}</ErrorMsg>}
            </ErrorMessage>
          </SignFormContainer.Group>

          <SignFormContainer.Group controlId="accountType">
            <AccountTypeToggle>
              <button
                type="button"
                className={values.accountType === 'individual' ? 'active' : ''}
                onClick={() => setFieldValue('accountType', 'individual')}
              >
                <Icon icon={faUser} />
                Individual
              </button>
              <button
                type="button"
                className={values.accountType === 'corporate' ? 'active' : ''}
                onClick={() => setFieldValue('accountType', 'corporate')}
              >
                <Icon icon={faBuilding} />
                Empresa
              </button>
            </AccountTypeToggle>
          </SignFormContainer.Group>

          <div className="form-actions">
            <Button type="submit" disabled={isSubmitting}>
              {form.action}
              {isSubmitting && <Spinner size="sm" />}
            </Button>
          </div>
          <Collapse in={newSignUpAction}>
            <div className="row">
              <div className="col">
                <Alert>{signUpMsg}</Alert>
              </div>
            </div>
          </Collapse>
        </SignFormContainer>
      )}
    </Formik>
  );
}

export default SingUpForm;
