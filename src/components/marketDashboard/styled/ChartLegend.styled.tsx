import styled from 'styled-components';

export const LegendContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  padding: 4px 8px;
  font-size: 11px;
  min-height: 20px;
`;

export const LegendItem = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  cursor: pointer;
  color: #555;

  &:hover {
    color: #111;
  }
`;

export const LegendColor = styled.span<{ color: string }>`
  width: 10px;
  height: 3px;
  border-radius: 1px;
  background: ${(props) => props.color};
  display: inline-block;
`;
