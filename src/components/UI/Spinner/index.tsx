import {
  Spinner as BsSpinner,
  SpinnerProps as BsSpinnerProps,
} from 'react-bootstrap';
import { FC } from 'react';
import styled from 'styled-components';

const Spinner: FC<BsSpinnerProps> = styled(BsSpinner)`
  width: 16px;
  height: 16px;
`;

export default Spinner;
