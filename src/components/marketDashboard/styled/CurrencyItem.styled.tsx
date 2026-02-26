import styled from 'styled-components';
import tokens from 'design-tokens/tokens.json';

const designSystem = tokens.xerenity;

export const CurrencyItemContainer = styled.div<{ isSelected: boolean }>`
  display: flex;
  align-items: center;
  padding: 8px 12px;
  font-size: 13px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  background: ${(props) => (props.isSelected ? designSystem['purple-200'].value : 'transparent')};
  color: ${(props) => (props.isSelected ? 'white' : '#333')};
  font-weight: ${(props) => (props.isSelected ? 600 : 400)};

  &:hover {
    background: ${(props) =>
      props.isSelected ? designSystem['purple-200'].value : designSystem['beige-50'].value};
  }
`;

export const CurrencyPanelTitle = styled.div`
  padding: 10px 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: #999;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #e0e0e0;
`;

export const CurrencySectionHeader = styled.div`
  padding: 6px 12px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  color: ${designSystem['purple-200'].value};
  background: ${designSystem['beige-50'].value};
  letter-spacing: 0.5px;
  border-bottom: 1px solid #e0e0e0;
`;
