import styled from 'styled-components';
import tokens from 'design-tokens/tokens.json';

const designSystem = tokens.xerenity;

const LIGHT_PURPLE = designSystem['purple-10'].value;
const PURPLE_100 = designSystem['purple-100'].value;
const LIGHT_GRAY = designSystem['gray-100'].value;

const GroupList = styled.section`
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: scroll;
  height: 100%;
`;

type ListItemProps = {
  isActive: boolean;
  justifyContent?: string;
};

export const ListItem = styled.div<ListItemProps>`
  height: 62px;
  background: ${(props) => (props.isActive ? LIGHT_PURPLE : LIGHT_GRAY)};
  display: flex;
  align-items: center;
  justify-content: ${(props) =>
    props.justifyContent ? props.justifyContent : 'space-between'};
  gap: 2%;
  border-radius: 8px;
  padding: 0 10px;
  transition: all 0.4s ease-in-out;
  cursor: pointer;
  border: solid 1px ${LIGHT_GRAY};
  overflow: hidden;
  &:hover {
    border: solid 1px ${PURPLE_100};
  }
`;

export const ListItemActions = styled.div`
  height: 62px;
  align-items: center;
  display: flex;
  gap: 10px;
`;

export default GroupList;
