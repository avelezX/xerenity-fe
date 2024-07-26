import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { PropsWithChildren } from 'react';
import { Button, Modal as BsModal } from 'react-bootstrap';
import Spinner from '@components/UI/Spinner';
import ModalBody from './ModalBody.styled';

type ModalProps = {
  onCancel?: () => void;
  cancelText?: string;
  onSave?: () => void;
  saveText?: string;
  title: string;
  display: boolean;
  icon?: IconProp;
  isSubmitting?: boolean;
} & PropsWithChildren;

const Modal = ({
  display,
  onCancel,
  cancelText,
  onSave,
  saveText,
  title,
  icon,
  children,
  isSubmitting,
}: ModalProps) => (
  <div className="modal show" style={{ display: 'block', position: 'initial' }}>
    <BsModal show={display} onHide={onCancel} centered>
      <BsModal.Header closeButton>
        <BsModal.Title>
          {icon && <Icon icon={icon} style={{ marginRight: '8px' }} />}
          {title}
        </BsModal.Title>
      </BsModal.Header>
      <ModalBody>{children}</ModalBody>
      <BsModal.Footer>
        <Button variant="outline-primary" onClick={onCancel}>
          {cancelText}
        </Button>
        {saveText && (
          <Button
            variant="primary"
            onClick={onSave}
            className="d-flex justify-content-center gap-3"
          >
            {saveText}
            {isSubmitting && <Spinner size="sm" />}
          </Button>
        )}
      </BsModal.Footer>
    </BsModal>
  </div>
);

export default Modal;
