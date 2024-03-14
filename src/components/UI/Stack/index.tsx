import { Stack as BsStack, StackProps as BsStackProps } from 'react-bootstrap';
import { FC } from 'react';

import styled from 'styled-components';

interface StackProps extends BsStackProps {
  $fullwidth?: boolean;
}

const Stack: FC<StackProps> = styled(BsStack)`
  width: ${(props) => (props.$fullwidth ? '100%' : 'auto')};
`;

export default Stack;
