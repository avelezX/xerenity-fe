import {
  Button as BsButton,
  ButtonProps as BsButtonProps,
} from 'react-bootstrap';
import { FC } from 'react';
import styled from 'styled-components';

interface ButtonProps extends BsButtonProps {
  $fullwidth?: boolean;
}

const Button: FC<ButtonProps> = styled(BsButton)`
  width: ${(props) => (props.$fullwidth ? '100%' : 'auto')};
  display: flex;
  height: 38px;
  gap: 8px;
  align-items: center;
  justify-content: center;
  text-indent: unset;
  white-space: nowrap;
`;

export default Button;
