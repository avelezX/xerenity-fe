import { FC } from 'react';
import {
  Button as BsButton,
  ButtonProps as BsButtonProps,
} from 'react-bootstrap';
import styled from 'styled-components';

type ColoredButtonProps={
  color:string;
} & BsButtonProps;

const ColoredButtonWrapper: FC<ColoredButtonProps> = styled(BsButton)`
  width: 33px;
  height: 33px;
  display: flex;
  gap: 8px;
  padding: 8px;
  align-items: center;
  background-color: ${(props) => props.color};
  justify-content: center;

  &:hover {
    svg,
    path,
    rect {
      fill: white;
    }
  }
`;

export default ColoredButtonWrapper;
