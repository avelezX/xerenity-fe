import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faEnvelope,
  faLock,
  faUser,
  faEarthAmericas,
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
import strings from '../../../strings/signup.json';
import ErrorMsg from '../_ErrorMsg';
import countries from '../../../strings/countries.json';
import SignFormContainer from './SignFormContainer.styled';

const { form } = strings;

function SingUpForm() {
  const supabase = createClientComponentClient();
  const [signUpMsg, setSignUpMsg] = useState('');
  const [newSignUpAction, setNewSignUpAction] = useState<boolean>(false);

  const signUpSchema = Yup.object().shape({
    email: Yup.string().email(form.emailInvalid).required(form.required),
    password: Yup.string().min(10).required(form.required),
    name: Yup.string().min(2).required(form.required),
    country: Yup.string().min(2).required(form.required),
  });

  const initialValues = {
    email: '',
    password: '',
    name: '',
    country: 'CO',
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
        emailRedirectTo: 'https://xerenity.vercel.app/api/auth/callback',
        data: {
          full_name: preparedValues.name,
          country: preparedValues.country,
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
      {({ values, handleChange, isSubmitting, handleSubmit }) => (
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
