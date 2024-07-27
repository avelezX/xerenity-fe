import { LightSerieEntry } from 'src/types/lightserie';
import Modal from '@components/UI/Modal';
import { faLineChart } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { SourcePill } from '@components/UI/Card/Card.styled';
import ModalContent from '@components/UI/Modal/ModalContent.styled';

type SerieInfoModalProps = {
  onCancel: () => void;
  show: boolean;
  serie: LightSerieEntry | null;
};

const MODAL_TITLE = 'Información De Serie';
const CANCEL_TXT = 'Cerrar';
const DESCRIPTION_TXT = 'Descripción:';

const SerieInfoModal = ({ show, onCancel, serie }: SerieInfoModalProps) => (
  <Modal
    onCancel={onCancel}
    cancelText={CANCEL_TXT}
    title={MODAL_TITLE}
    display={show}
  >
    <ModalContent>
      <div className="info-title">
        <Icon icon={faLineChart} style={{ fontSize: '24px' }} />
        <h5>{serie?.display_name}</h5>
      </div>
      <div className="info-description">
        <h5>{DESCRIPTION_TXT}</h5>
        <p>{serie?.description}</p>
      </div>
      <div className="info-footer">
        <SourcePill>Fuente: {serie?.fuente}</SourcePill>
      </div>
    </ModalContent>
  </Modal>
);

export default SerieInfoModal;
