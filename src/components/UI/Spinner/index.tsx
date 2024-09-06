import {
  Spinner as BsSpinner,
  SpinnerProps as BsSpinnerProps,
} from 'react-bootstrap';
import styled from 'styled-components';

const Spinner = styled(BsSpinner)<BsSpinnerProps>`
  width: 16px;
  height: 16px;
`;

export default Spinner;
