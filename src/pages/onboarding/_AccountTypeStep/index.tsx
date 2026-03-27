import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faUser, faBuilding } from '@fortawesome/free-solid-svg-icons';
import styled from 'styled-components';
import strings from '../../../strings/onboarding.json';

const { steps } = strings;

interface AccountTypeStepProps {
  onSelect: (type: 'individual' | 'corporate') => void;
  loading?: boolean;
}

const CardGrid = styled.div`
  display: flex;
  gap: 20px;
  justify-content: center;
  margin-top: 20px;

  @media (max-width: 640px) {
    flex-direction: column;
    align-items: center;
  }
`;

const TypeCard = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 40px;
  border: 2px solid #dedede;
  border-radius: 12px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 220px;

  &:hover {
    border-color: #302b63;
    box-shadow: 0 4px 12px rgba(48, 43, 99, 0.15);
    transform: translateY(-2px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .icon {
    font-size: 36px;
    color: #302b63;
  }

  .label {
    font-size: 16px;
    font-weight: 600;
    color: #302b63;
  }

  .desc {
    font-size: 13px;
    color: #8e8e8e;
    text-align: center;
  }
`;

function AccountTypeStep({ onSelect = () => {}, loading = false }: Partial<AccountTypeStepProps>) {
  return (
    <CardGrid>
      <TypeCard
        type="button"
        onClick={() => onSelect('individual')}
        disabled={loading}
      >
        <Icon icon={faUser} className="icon" />
        <span className="label">{steps.accountType.individual}</span>
        <span className="desc">{steps.accountType.individualDesc}</span>
      </TypeCard>
      <TypeCard
        type="button"
        onClick={() => onSelect('corporate')}
        disabled={loading}
      >
        <Icon icon={faBuilding} className="icon" />
        <span className="label">{steps.accountType.enterprise}</span>
        <span className="desc">{steps.accountType.enterpriseDesc}</span>
      </TypeCard>
    </CardGrid>
  );
}

export default AccountTypeStep;
