import styled from 'styled-components';
import tokens from 'design-tokens/tokens.json';

const designSystem = tokens.xerenity;

export const TabsContainer = styled.div`
  display: flex;
  gap: 2px;
  align-items: center;
  border: 1px solid ${designSystem['purple-200'].value};
  border-radius: 18px;
  padding: 2px;
`;

export const InfoLink = styled.a`
  margin-left: 4px;
  font-size: 18px;
  text-decoration: none;
  opacity: 0.5;
  transition: opacity 0.15s;

  svg,
  path {
    fill: ${designSystem['purple-200'].value} !important;
  }

  &:hover {
    opacity: 1;
    text-decoration: none;
  }
`;

export const TabLink = styled.a<{ isActive: boolean }>`
  padding: 6px 18px;
  font-size: 13px;
  font-weight: ${(props) => (props.isActive ? 600 : 400)};
  color: ${(props) =>
    props.isActive ? 'white' : designSystem['purple-300'].value};
  background: ${(props) =>
    props.isActive ? designSystem['purple-200'].value : 'transparent'};
  border-radius: 14px;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: ${(props) =>
      props.isActive
        ? designSystem['purple-200'].value
        : designSystem['beige-50'].value};
    text-decoration: none;
    color: ${(props) =>
      props.isActive ? 'white' : designSystem['purple-300'].value};
  }
`;
