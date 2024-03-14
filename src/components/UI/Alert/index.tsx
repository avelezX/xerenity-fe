import { Alert as BsAlert, AlertProps as BsAlertProps } from 'react-bootstrap';
import { FC } from 'react';

import styled from 'styled-components';

interface AlertProps extends BsAlertProps {
  $fullwidth?: boolean;
}

const Alert: FC<AlertProps> = styled(BsAlert)`
  width: ${(props) => (props.$fullwidth ? '100%' : 'auto')};
`;

export default Alert;
