import { FC } from 'react';
import {
  Button as BsButton,
  ButtonProps as BsButtonProps,
} from 'react-bootstrap';
import styled from 'styled-components';

const IconButtonWrapper: FC<BsButtonProps> = styled(BsButton)`
  width: 33px;
  height: 33px;
  display: flex;
  gap: 8px;
  padding: 8px;
  align-items: center;
  justify-content: center;

  &:hover {
    svg,
    path,
    rect {
      fill: white;
    }
  }
`;

export default IconButtonWrapper;
