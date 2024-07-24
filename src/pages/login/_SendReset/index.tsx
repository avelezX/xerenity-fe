import Modal from '@components/UI/Modal';
import {
  Formik,
  ErrorMessage,
  FormikConfig,
  prepareDataForValidation,
} from 'formik';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { toast } from 'react-toastify';
import { Form, InputGroup } from 'react-bootstrap';
import * as Yup from 'yup';
import { faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import strings from '../../../strings/sendResetPassword.json';
import ErrorMsg from '../_ErrorMsg';

const { form } = strings;

type SendResetProps = {
  onCancel: () => void;
  show: boolean;
  modalTitle: string;
};

const CANCEL_TXT = 'Cancelar';
const SAVE_TXT = 'Enviar';

function SendResetPasswordModal({
  onCancel,
  show,
  modalTitle,
}: SendResetProps) {
  const supabase = createClientComponentClient();

  const sendEmailSchema = Yup.object().shape({
    email: Yup.string().email().required(),
  });

  const initialValues = {
    email: '',
  };

  const onSubmit: FormikConfig<typeof initialValues>['onSubmit'] = async (
    formValues
  ) => {
    const preparedValues = sendEmailSchema.cast(
      prepareDataForValidation(formValues)
    );
    const { data, error } = await supabase.auth.resetPasswordForEmail(
      preparedValues.email,
      {
        redirectTo: 'login/reset',
      }
    );
    if (error) {
      toast.error(error.message, {
        position: toast.POSITION.BOTTOM_RIGHT,
      });
    } else if (data) {
      toast.info(form.success, {
        position: toast.POSITION.BOTTOM_RIGHT,
      });
    }
  };

  return (
    <Formik
      initialValues={initialValues}
      onSubmit={onSubmit}
      validationSchema={sendEmailSchema}
    >
      {({ values, handleChange, handleSubmit }) => (
        <Modal
          display={show}
          title={modalTitle}
          onCancel={onCancel}
          onSave={handleSubmit}
          cancelText={CANCEL_TXT}
          saveText={SAVE_TXT}
        >
          <Form className="w-50 d-flex justify-content-center flex-column gap-3">
            <Form.Group controlId="email">
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
          </Form>
        </Modal>
      )}
    </Formik>
  );
}

export default SendResetPasswordModal;
