import {
  Container as BsContainer,
  ContainerProps as BsContainerProps,
} from 'react-bootstrap';
import { FC } from 'react';

import styled from 'styled-components';

interface ContainerProps extends BsContainerProps {
  $fullwidth?: boolean;
}

const Container: FC<ContainerProps> = styled(BsContainer)`
  width: ${(props) => (props.$fullwidth ? '100%' : 'auto')};
`;

export default Container;
