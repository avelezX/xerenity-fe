import styled from 'styled-components';
import tokens from 'design-tokens/tokens.json';

const designSystem = tokens.xerenity;

export const WatchlistRowContainer = styled.div<{
  isSelected: boolean;
  selectedColor?: string;
}>`
  display: grid;
  grid-template-columns: 1fr 80px 70px 60px;
  align-items: center;
  padding: 4px 8px;
  font-size: 12px;
  border-bottom: 1px solid #f0f0f0;
  border-left: 3px solid
    ${(props) => (props.isSelected && props.selectedColor ? props.selectedColor : 'transparent')};
  cursor: pointer;
  background: ${(props) => (props.isSelected ? '#f8f7ff' : 'transparent')};

  &:hover {
    background: ${designSystem['beige-50'].value};
  }

  .row-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: ${(props) => (props.isSelected ? 500 : 400)};
    color: #333;
  }

  .row-value {
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: #333;
  }
`;

export const ChangeValue = styled.span<{ positive: boolean | null }>`
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: ${(props) => {
    if (props.positive === null) return '#999';
    return props.positive
      ? designSystem['green-500'].value
      : designSystem['red-600'].value;
  }};
`;
