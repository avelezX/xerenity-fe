import styled from 'styled-components';
import tokens from 'design-tokens/tokens.json';

const designSystem = tokens.xerenity;

export const PeriodButtonGroup = styled.div`
  display: flex;
  gap: 4px;
  align-items: center;
`;

export const PeriodButton = styled.button<{ active: boolean }>`
  border: none;
  background: ${(props) =>
    props.active ? designSystem['purple-200'].value : 'transparent'};
  color: ${(props) => (props.active ? 'white' : '#666')};
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: ${(props) =>
      props.active ? designSystem['purple-200'].value : '#f0f0f0'};
  }
`;
