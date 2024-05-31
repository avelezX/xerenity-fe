import { forwardRef, Ref } from 'react';
import { Form } from 'react-bootstrap';

type BalanceFieldProps = {
  value: string;
  onChange: () => void;
};

const PLACEHOLDER = 'Añade un balance';

const BalanceField = (
  { onChange, value }: BalanceFieldProps,
  ref: Ref<HTMLInputElement>
) => (
  <Form.Control
    ref={ref}
    value={value}
    placeholder={PLACEHOLDER}
    onChange={onChange}
  />
);

export default forwardRef(BalanceField);
