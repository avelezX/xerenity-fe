import { PropsWithChildren, RefObject } from 'react';
import styled from 'styled-components';
import { Overlay } from 'react-bootstrap';
import tokens from 'design-tokens/tokens.json';

const OverlayContainer = styled.div`
  display: flex;
  flex-direction: column;
  background-color: white;
  border-radius: 8px;
  border: solid 1px #cecece;
  box-shadow: 2px 6px 10px 0px rgba(51, 51, 3, 0.2);
  z-index: 999;
  .nav-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    &:hover {
      color: ${tokens.xerenity['purple-200'].value};
    }
  }
`;

type SubNavOverlayProps = {
  target: RefObject<HTMLDivElement>;
  show: boolean;
  onHide: () => void;
} & PropsWithChildren;

const SubNavOverlay = ({
  children,
  target,
  show,
  onHide,
}: SubNavOverlayProps) => (
  <Overlay
    rootClose
    target={target?.current}
    show={show}
    placement="right-start"
    onHide={onHide}
  >
    <OverlayContainer>{children}</OverlayContainer>
  </Overlay>
);

export default SubNavOverlay;
