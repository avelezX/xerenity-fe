import styled from 'styled-components';

export const TableHeader = styled.thead`
  height: 50px;
`;

export const HeaderCell = styled.th<{ alignRight?: boolean }>`
  text-align: ${(props) => (props.alignRight ? 'right' : 'left')};
`;

export const TableCell = styled.td<{ alignRight?: boolean }>`
  text-align: ${(props) => (props.alignRight ? 'right' : 'left')};
  vertical-align: middle;
`;

export const TableRow = styled.tr`
  height: 50px;
`;
