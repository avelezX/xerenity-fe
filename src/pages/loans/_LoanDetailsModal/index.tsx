import Modal from '@components/UI/Modal';
import { faLandmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { SourcePill } from '@components/UI/Card/Card.styled';
import ModalContent from '@components/UI/Modal/ModalContent.styled';
import { Loan } from '@models/loans';
import styled from 'styled-components';
import currencyFormat from 'src/utils/currencyFormat';
import tokens from 'design-tokens/tokens.json';
import { CSSProperties } from 'react';

const designSystem = tokens.xerenity;
const WEIGHT_MD = designSystem.medium.value;

const valueStyles: CSSProperties = {
  fontWeight: WEIGHT_MD,
};

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
    font-weight: ${WEIGHT_MD};
  }

  &:first-child {
    border: none;
  }
`;

const MODAL_TITLE = 'Detalles Del Crédito';
const CANCEL_TXT = 'Cerrar';
const DETALLES_TXT = 'Detalles:';
const TASA_TXT = 'Tasa: ';
const BALANCE_TXT = 'Balance Original:';
const PERIODICIDAD_TXT = 'Periodicidad:';
const INTERES_TXT = 'Interés:';

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
            <h6>{BALANCE_TXT}</h6>
            <span style={valueStyles}>
              {loan ? currencyFormat(loan.original_balance) : ''}
            </span>
          </ItemDetail>
          <ItemDetail>
            <h6>{PERIODICIDAD_TXT}</h6>
            <span style={valueStyles}>{loan?.periodicity}</span>
          </ItemDetail>
          <ItemDetail>
            <h6>{INTERES_TXT}</h6>
            <span style={valueStyles}>{`${loan?.interest_rate}%`}</span>
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
