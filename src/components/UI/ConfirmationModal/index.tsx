import Modal from '@components/UI/Modal';
import ModalContent from '../Modal/ModalContent.styled';

type ConfirmationModalProps = {
  onCancel: () => void;
  onDelete: () => void;
  show: boolean;
  deleteText: string;
  modalTitle: string;
};

const CANCEL_TXT = 'Cancelar';
const SAVE_TXT = 'Borrar Crédito';

const ConfirmationModal = ({
  onCancel,
  onDelete,
  show,
  deleteText,
  modalTitle,
}: ConfirmationModalProps) => (
  <Modal
    display={show}
    title={modalTitle}
    onCancel={onCancel}
    onSave={onDelete}
    cancelText={CANCEL_TXT}
    saveText={SAVE_TXT}
  >
    <ModalContent>
      <div className="info-description">{deleteText}</div>
    </ModalContent>
  </Modal>
);

export default ConfirmationModal;
