import styled from 'styled-components';
import tokens from 'design-tokens/tokens.json';
import { IconDefinition } from '@fortawesome/free-solid-svg-icons';

export type TabItemType = {
  name: string;
  property: string;
  icon?: IconDefinition;
  active: boolean;
};

const designSystem = tokens.xerenity;
const PRIMARY_COLOR = designSystem['purple-200'].value;
const INACTIVE_COLOR = '#878594';

export const Tab = styled.div<{ active: boolean }>`
  display: flex;
  color: ${(props) => (props.active ? PRIMARY_COLOR : INACTIVE_COLOR)};
  padding: 12px 0;
  border-bottom: solid 2px
    ${(props) => (props.active ? PRIMARY_COLOR : 'transparent')};
  cursor: pointer;
  align-items: center;
  gap: 10px;

  &:hover {
    color: ${PRIMARY_COLOR};
  }
`;

export const Tabs = styled.div<{ outlined?: boolean }>`
  background: white;
  display: flex;
  padding: 0 16px;
  gap: 29px;
  border-radius: 8px;
  border: ${(props) => (props.outlined ? 'solid 1px #dedede' : 'none')};
`;
