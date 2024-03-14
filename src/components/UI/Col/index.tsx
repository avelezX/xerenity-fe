import { Col as BsCol, ColProps as BsColProps } from 'react-bootstrap';
import { FC } from 'react';

import styled from 'styled-components';

interface ColProps extends BsColProps {
  $fullwidth?: boolean;
}

const Col: FC<ColProps> = styled(BsCol)`
  width: ${(props) => (props.$fullwidth ? '100%' : 'auto')};
`;

export default Col;
