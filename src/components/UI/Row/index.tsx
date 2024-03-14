import { Row as BsRow, RowProps as BsRowProps } from 'react-bootstrap';
import { FC } from 'react';

import styled from 'styled-components';

interface RowProps extends BsRowProps {
  $fullwidth?: boolean;
}

const Row: FC<RowProps> = styled(BsRow)`
  width: ${(props) => (props.$fullwidth ? '100%' : 'auto')};
`;

export default Row;
