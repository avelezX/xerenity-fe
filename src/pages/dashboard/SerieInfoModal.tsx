import { LightSerieEntry } from 'src/types/lightserie';
import Modal from '@components/UI/Modal';
import styled from 'styled-components';
import { faLineChart } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { SourcePill } from '@components/UI/Card/Card.styled';
import tokens from 'design-tokens/tokens.json';

const designSystem = tokens.xerenity;
const PRIMARY_COLOR = designSystem['purple-200'].value;
const LIGHT_PURPLE = designSystem['purple-10'].value;
const TEXT_MD = designSystem['text-md'].value;
const SEMI_BOLD = designSystem['semi-bold'].value;

type SerieInfoModalProps = {
  onCancel: () => void;
  show: boolean;
  serie: LightSerieEntry | null;
};

// TODO: Migrate this when more than one component implement it
const InfoContainer = styled.header`
  display: flex;
  flex-direction: column;
  .info-title {
    background-color: ${LIGHT_PURPLE};
    padding: 18px 16px;
    display: flex;
    align-items: center;
    gap: 15px;
    h5 {
      color: ${PRIMARY_COLOR};
      margin-bottom: 0;
    }
    svg,
    path,
    rect {
      fill: ${PRIMARY_COLOR};
    }
  }
  .info-description {
    padding: 16px;
    h5 {
      font-weight: ${SEMI_BOLD};
      font-size: ${TEXT_MD};
    }
  }
  .info-footer {
    display: flex;
    padding: 16px;
    justify-content: center;
  }
`;

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
    <InfoContainer>
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
    </InfoContainer>
  </Modal>
);

export default SerieInfoModal;
