import styled from 'styled-components';
import tokens from 'design-tokens/tokens.json';

const designSystem = tokens.xerenity;

const LIGHT_PURPLE = designSystem['purple-10'].value;
const PURPLE_100 = designSystem['purple-100'].value;
const LIGHT_GRAY = designSystem['gray-100'].value;

const ListItemContainer = styled.div<{
  isActive: boolean;
  justifyContent?: string;
}>`
  height: 62px;
  min-height: 62px;
  background: ${(props) => (props.isActive ? LIGHT_PURPLE : LIGHT_GRAY)};
  display: flex;
  align-items: center;
  justify-content: ${(props) =>
    props.justifyContent ? props.justifyContent : 'space-between'};
  gap: 3%;
  border-radius: 8px;
  padding: 0 10px;
  transition: all 0.4s ease-in-out;
  cursor: pointer;
  border: solid 1px ${LIGHT_GRAY};
  overflow: hidden;
  &:hover {
    border: solid 1px ${PURPLE_100};
  }

  .item-information {
    display: flex;
    flex-direction: column;
    span {
      font-size: 14px;
      align-items: center;
      justify-content: center;
      text-indent: unset;
      white-space: nowrap;
    }
  }
`;

export default ListItemContainer;
