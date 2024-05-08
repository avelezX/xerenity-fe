import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { PropsWithChildren } from 'react';
import { Button, Modal as BsModal } from 'react-bootstrap';

type ModalProps = {
  cancelCallback: () => void;
  cancelMessage: string;
  saveCallback: () => void;
  saveMessage: string;
  title: string;
  display: boolean;
  icon?: IconProp;
} & PropsWithChildren;

const Modal = ({
  display,
  cancelCallback,
  cancelMessage,
  saveCallback,
  saveMessage,
  title,
  icon,
  children,
}: ModalProps) => (
  <div className="modal show" style={{ display: 'block', position: 'initial' }}>
    <BsModal show={display} onHide={cancelCallback}>
      <BsModal.Header closeButton>
        <BsModal.Title>
          {icon && <Icon icon={icon} style={{ marginRight: '8px' }} />}
          {title}
        </BsModal.Title>
      </BsModal.Header>
      <BsModal.Body>{children}</BsModal.Body>
      <BsModal.Footer>
        <Button variant="outline-primary" onClick={cancelCallback}>
          {cancelMessage}
        </Button>
        <Button variant="primary" onClick={saveCallback}>
          {saveMessage}
        </Button>
      </BsModal.Footer>
    </BsModal>
  </div>
);

export default Modal;
