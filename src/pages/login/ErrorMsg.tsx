import styled from 'styled-components';
import tokens from '../../../design-tokens/tokens.json';

const { xerenity } = tokens;

const ErrorMsg = styled.span`
  color: ${xerenity['red-400'].value};
  font-size: 14px;
  text-align: center;
`;

export default ErrorMsg;
