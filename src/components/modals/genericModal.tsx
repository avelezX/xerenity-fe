import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { PropsWithChildren } from 'react';
import { Button, Modal } from 'react-bootstrap';

type ModalProps = {
  cancelCallback: () => void;
  cancelMessage: string;
  saveCallback: () => void;
  saveMessage: string;
  title: string;
  display: boolean;
  icon: IconProp;
} & PropsWithChildren;

function SimpleModal({
  display,
  cancelCallback,
  cancelMessage,
  saveCallback,
  saveMessage,
  title,
  icon,
  children,
}: ModalProps) {
  return (
    <div
      className="modal show"
      style={{ display: 'block', position: 'initial' }}
    >
      <Modal show={display} onHide={cancelCallback}>
        <Modal.Header closeButton>
          <Modal.Title>
            <FontAwesomeIcon icon={icon} /> {title}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {children}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="danger"  onClick={cancelCallback}>
            {cancelMessage}
          </Button>
          <Button variant="primary" onClick={saveCallback}>
            {saveMessage}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default SimpleModal;