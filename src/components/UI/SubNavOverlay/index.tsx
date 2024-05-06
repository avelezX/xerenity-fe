import { PropsWithChildren, RefObject } from 'react';
import { Overlay } from 'react-bootstrap';
import OverlayContainer from './OverlayContainer.styled';

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
