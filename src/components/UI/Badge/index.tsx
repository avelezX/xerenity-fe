import { Badge as BsBadge } from 'react-bootstrap';
import styled from 'styled-components';

const Badge = styled(BsBadge)`
  background-color: ${(props) => props.bg};
  border-radius: 100px;
`;

export default Badge;
