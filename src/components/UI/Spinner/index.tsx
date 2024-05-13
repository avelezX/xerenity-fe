import { Spinner as BsSpinner, SpinnerProps as BsSpinnerProps } from 'react-bootstrap';
import { FC } from 'react';

import styled from 'styled-components';

interface SpinnerProps extends BsSpinnerProps{

}

const Spinner: FC<SpinnerProps> = styled(BsSpinner)``;

export default Spinner;
