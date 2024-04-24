import styled from 'styled-components';
import tokens from 'design-tokens/tokens.json';

const designSystem = tokens.xerenity;

export const Tab = styled.div<{ active: boolean }>`
  display: flex;
  color: ${(props) =>
    props.active ? designSystem['purple-200'].value : '#878594'};
  padding: 12px 0;
  border-bottom: solid 2px
    ${(props) =>
      props.active ? designSystem['purple-200'].value : 'transparent'};
  cursor: pointer;
  align-items: center;
  gap: 10px;

  &:hover {
    color: ${designSystem['purple-200'].value};
  }
`;

export const Tabs = styled.div`
  background: white;
  display: flex;
  padding: 0 16px;
  gap: 29px;
  border-radius: 8px;
  border: solid 1px #dedede;
`;
