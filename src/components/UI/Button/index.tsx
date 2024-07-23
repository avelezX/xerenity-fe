import {
  Button as BsButton,
  ButtonProps as BsButtonProps,
} from 'react-bootstrap';
import { FC } from 'react';
import styled from 'styled-components';

interface ButtonProps extends BsButtonProps {
  $fullwidth?: boolean;
  height?: string;
}

const Button: FC<ButtonProps> = styled(BsButton)`
  width: ${(props) => (props.$fullwidth ? '100%' : 'auto')};
  background-color: ${(props) => props.bg};
  display: flex;
  height: ${(props) => props.height || '38px'};
  gap: 8px;
  align-items: center;
  justify-content: center;
  text-indent: unset;
  white-space: nowrap;
`;

export default Button;
