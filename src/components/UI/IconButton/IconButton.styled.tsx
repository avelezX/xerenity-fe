import {
  Button as BsButton,
  ButtonProps as BsButtonProps,
} from 'react-bootstrap';
import styled from 'styled-components';

const IconButtonWrapper = styled(BsButton)<BsButtonProps>`
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
