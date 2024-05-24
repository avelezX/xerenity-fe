import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faLock,faUser,faEarthAmericas } from '@fortawesome/free-solid-svg-icons';
import { Form, InputGroup, Collapse } from 'react-bootstrap';
import { useRef, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Button from '@components/UI/Button';
import Alert from '@components/UI/Alert';
import {
  Formik,
  ErrorMessage,
  FormikConfig,
  prepareDataForValidation,
} from 'formik';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import Spinner from '@components/UI/Spinner';
import * as Yup from 'yup';
import strings from '../../strings/signup.json';
import ErrorMsg from './ErrorMsg';
import countries from '../../strings/countries.json';


const { form } = strings;

function SingUpForm() {
    const supabase = createClientComponentClient();
    const [signUpMsg, setSignUpMsg] = useState('');
    const [newSignUpAction, setNewSignUpAction] = useState<boolean>(false);
    const [captchaToken, setCaptchaToken] = useState<string | undefined>(undefined);
    const captcha = useRef<HCaptcha>(null);


    const signUpSchema = Yup.object().shape({
        email: Yup.string().email(form.emailInvalid).required(form.required),
        password: Yup.string().min(10).required(form.required),
        name:Yup.string().min(2).required(form.required),
        country:Yup.string().min(2).required(form.required)
    });

    const initialValues = {
        email: '',
        password: '',
        name:'',
        country:'CO'
    };

    const onSubmit: FormikConfig<typeof initialValues>['onSubmit'] = async (
        formValues
    ) => {
        const preparedValues = signUpSchema.cast(
            prepareDataForValidation(formValues)
        );
        
        setNewSignUpAction(false);
        const res = await supabase.auth.signUp(  {
            email: preparedValues.email,
            password: preparedValues.password,
            options: {
                captchaToken,
                data: {
                    full_name: preparedValues.name,
                    country: preparedValues.country,
                }
            }
        }
        );

        if (res.error) {
            setSignUpMsg(res.error.message);
        } else {
            setSignUpMsg(form.confirmacion);
        }
        setNewSignUpAction(true);

        if(captcha.current){
          captcha.current.resetCaptcha();
          setCaptchaToken(undefined);
        }
        
};

  return (
    <Formik
      initialValues={initialValues}
      onSubmit={onSubmit}
      validationSchema={signUpSchema}
    >
      {({ values, handleChange, isSubmitting, handleSubmit }) => (
        <div className="d-flex flex-column w-100 justify-content-center align-items-center py-5">
          <Form
            onSubmit={handleSubmit}
            className="w-50 d-flex justify-content-center flex-column gap-3"
          >
            <Form.Group
              controlId="email"
              className='className="w-50 d-flex flex-column gap-2'
            >
              <InputGroup>
                <InputGroup.Text className="bg-white border-right-none">
                  <Icon className="text-primary" icon={faEnvelope} fixedWidth />
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

            <Form.Group
              controlId="password"
              className='className="w-50 d-flex flex-column gap-2'
            >
              <InputGroup>
                <InputGroup.Text className="bg-white border-right-none">
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

            <Form.Group
              controlId="name"
              className='className="w-50 d-flex flex-column gap-2'
            >
              <InputGroup>
                <InputGroup.Text className="bg-white border-right-none">
                  <Icon className="text-primary" icon={faUser} fixedWidth />
                </InputGroup.Text>
                <Form.Control
                  placeholder={form.nombre}
                  type="text"
                  value={values.name}
                  onChange={handleChange}
                />
              </InputGroup>
              <ErrorMessage name="name">
                {(msg: string) => <ErrorMsg>{msg}</ErrorMsg>}
              </ErrorMessage>
            </Form.Group>

            <Form.Group
              controlId="country"
              className='className="w-50 d-flex flex-column gap-2'
            >
              <InputGroup>
                <InputGroup.Text className="bg-white border-right-none">
                  <Icon className="text-primary" icon={faEarthAmericas} fixedWidth />
                </InputGroup.Text>
                <Form.Select
                  value={values.country}
                  onChange={handleChange}
                > 
                    {countries.map((cty)=>(
                      <option key={cty.code} value={cty.code}>{cty.name}</option>
                    ))}

                </Form.Select>
              </InputGroup>
              <ErrorMessage name="country">
                {(msg: string) => <ErrorMsg>{msg}</ErrorMsg>}
              </ErrorMessage>
            </Form.Group>
            <HCaptcha
              ref={captcha}
              languageOverride='es'
              sitekey="593e53a4-0b84-4d8a-a7e6-a3dc4098b152"
              onVerify={(token) => {
                setCaptchaToken(token);
              }}
            />

            <div className="d-flex justify-content-center p-4">
              <Button 
                type="submit" 
                disabled={captchaToken === undefined && !isSubmitting}>
                {form.action}
                <Collapse in={isSubmitting}>
                  <Spinner/>
                </Collapse>                
              </Button>
            </div>
            <Collapse in={newSignUpAction}>
              <div className="row">
                <div className="col">
                  <Alert>{signUpMsg}</Alert>
                </div>
              </div>
            </Collapse>
          </Form>
        </div>
      )}
    </Formik>
  );
}

export default SingUpForm;
