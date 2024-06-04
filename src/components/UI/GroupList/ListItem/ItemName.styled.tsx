import styled from 'styled-components';
import tokens from 'design-tokens/tokens.json';

const designSystem = tokens.xerenity;
const WEIGHT_MD = designSystem.medium.value;

const ItemName = styled.span<{ hasChildren: boolean }>`
  width: ${(props) => (props.hasChildren ? '25%' : '85%')};
  font-weight: ${WEIGHT_MD};
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 14px;
  cursor: pointer;
`;

export default ItemName;
