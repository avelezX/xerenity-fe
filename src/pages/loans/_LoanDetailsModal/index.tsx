import Modal from '@components/UI/Modal';
import { faLandmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { SourcePill } from '@components/UI/Card/Card.styled';
import ModalContent from '@components/UI/Modal/ModalContent.styled';
import { Loan } from '@models/loans';
import styled from 'styled-components';

type LoanDetailsModalProps = {
  onCancel: () => void;
  show: boolean;
  loan: Loan | undefined;
};

const ItemDetail = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: solid 1px #ccc;
  padding: 10px 0;
  h6 {
    margin-bottom: 0;
  }

  &:first-child {
    border: none;
  }
`;

const MODAL_TITLE = 'Detalles De Crédito';
const CANCEL_TXT = 'Cerrar';
const DETALLES_TXT = 'Detalles:';
const TASA_TXT = 'Tasa: ';

const LoanDetailsModal = ({ show, onCancel, loan }: LoanDetailsModalProps) => (
  <Modal
    onCancel={onCancel}
    cancelText={CANCEL_TXT}
    title={MODAL_TITLE}
    display={show}
  >
    <ModalContent>
      <div className="info-title">
        <Icon icon={faLandmark} style={{ fontSize: '24px' }} />
        <h5>{loan?.bank}</h5>
      </div>
      <div className="info-description">
        <h5>{DETALLES_TXT}</h5>
        <div className="d-flex flex-column justify-content-center">
          <ItemDetail>
            <h6>Balance Original:</h6>
            <span>{loan?.original_balance}</span>
          </ItemDetail>
          <ItemDetail>
            <h6>Periodicidad:</h6>
            <span>{loan?.periodicity}</span>
          </ItemDetail>
          <ItemDetail>
            <h6>Interés:</h6>
            <span>{`${loan?.interest_rate}%`}</span>
          </ItemDetail>
        </div>
      </div>
      <div className="info-footer">
        <SourcePill>
          {TASA_TXT}
          <span style={{ textTransform: 'capitalize' }}>{loan?.type}</span>
        </SourcePill>
      </div>
    </ModalContent>
  </Modal>
);

export default LoanDetailsModal;
