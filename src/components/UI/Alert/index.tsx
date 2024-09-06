import { Alert as BsAlert, AlertProps as BsAlertProps } from 'react-bootstrap';

import styled from 'styled-components';

interface AlertProps extends BsAlertProps {
  $fullwidth?: boolean;
}

const Alert = styled(BsAlert)<AlertProps>`
  width: ${(props) => (props.$fullwidth ? '100%' : 'auto')};
`;

export default Alert;
