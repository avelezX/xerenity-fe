import styled from 'styled-components';

export const LegendContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  padding: 6px 8px;
  font-size: 12.5px;
  min-height: 24px;
`;

export const LegendItem = styled.span`
  display: flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
  cursor: pointer;
  color: #555;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background 0.15s;

  &:hover {
    color: #111;
    background: rgba(0, 0, 0, 0.05);
  }
`;

export const LegendColor = styled.span<{ color: string }>`
  width: 10px;
  height: 3px;
  border-radius: 1px;
  background: ${(props) => props.color};
  display: inline-block;
`;

export const LegendClose = styled.span`
  font-size: 11px;
  color: #999;
  margin-left: 2px;
  line-height: 1;

  ${LegendItem}:hover & {
    color: #e44;
  }
`;
