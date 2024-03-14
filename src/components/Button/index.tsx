import { Button, ButtonProps } from 'react-bootstrap';
import { FC } from 'react';

import styled from 'styled-components';

interface XButtonProps extends ButtonProps {
  fullWidth?: boolean;
}

const XButton: FC<XButtonProps> = styled(Button)`
  width: ${(props) => (props.fullWidth ? '100%' : 'auto')};
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
`;

export default XButton;
