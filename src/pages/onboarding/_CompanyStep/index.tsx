import { useState } from 'react';
import { InputGroup, Form } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faBuilding,
  faIdCard,
  faArrowLeft,
} from '@fortawesome/free-solid-svg-icons';
import styled from 'styled-components';
import Button from '@components/UI/Button';
import Spinner from '@components/UI/Spinner';
import Alert from '@components/UI/Alert';
import { Company } from 'src/types/user';
import { isFreemailDomain } from 'src/utils/email-domain';
import strings from '../../../strings/onboarding.json';

const { steps } = strings;

interface CompanyStepProps {
  domain: string;
  domainCompanies: Company[];
  loading: boolean;
  onJoin: (companyId: string) => void;
  onCreate: (name: string, nit: string) => void;
  onBack: () => void;
}

const Container = styled.div`
  max-width: 480px;
  margin: 0 auto;
  padding-top: 20px;

  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: #302b63;
    margin-bottom: 12px;
  }

  .company-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 24px;
  }

  .company-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border: 1px solid #dedede;
    border-radius: 8px;
    background: white;

    .company-name {
      font-weight: 500;
      color: #333;
    }
  }

  .divider {
    text-align: center;
    color: #8e8e8e;
    font-size: 13px;
    margin: 20px 0;
    position: relative;

    &::before,
    &::after {
      content: '';
      position: absolute;
      top: 50%;
      width: 40%;
      height: 1px;
      background: #dedede;
    }

    &::before {
      left: 0;
    }

    &::after {
      right: 0;
    }
  }

  .create-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    color: #8e8e8e;
    cursor: pointer;
    font-size: 14px;
    padding: 0;
    margin-bottom: 20px;

    &:hover {
      color: #302b63;
    }
  }

  .freemail-notice {
    text-align: center;
    color: #8e8e8e;
    font-size: 13px;
    margin-bottom: 16px;
  }
`;

function CompanyStep({
  domain,
  domainCompanies,
  loading,
  onJoin,
  onCreate,
  onBack,
}: CompanyStepProps) {
  const [companyName, setCompanyName] = useState('');
  const [companyNit, setCompanyNit] = useState('');
  const [error, setError] = useState('');
  const isFreemail = isFreemailDomain(domain);

  const handleCreate = () => {
    if (!companyName.trim()) {
      setError('El nombre de la empresa es requerido');
      return;
    }
    setError('');
    onCreate(companyName.trim(), companyNit.trim());
  };

  return (
    <Container>
      <button type="button" className="back-btn" onClick={onBack}>
        <Icon icon={faArrowLeft} />
        {steps.company.back}
      </button>

      <h3
        style={{
          fontSize: '18px',
          fontWeight: 600,
          color: '#302b63',
          marginBottom: '8px',
        }}
      >
        {steps.company.title}
      </h3>
      <p style={{ color: '#8e8e8e', fontSize: '14px', marginBottom: '20px' }}>
        {steps.company.subtitle}
      </p>

      {/* Show matching companies for corporate domains */}
      {!isFreemail && domainCompanies.length > 0 && (
        <>
          <div className="section-title">{steps.company.joinExisting}</div>
          <div className="company-list">
            {domainCompanies.map((company) => (
              <div key={company.id} className="company-item">
                <span className="company-name">{company.name}</span>
                <Button
                  size="sm"
                  onClick={() => onJoin(company.id)}
                  disabled={loading}
                >
                  {steps.company.join}
                  {loading && <Spinner size="sm" />}
                </Button>
              </div>
            ))}
          </div>
          <div className="divider">o</div>
        </>
      )}

      {!isFreemail && domainCompanies.length === 0 && (
        <p className="freemail-notice">{steps.company.noMatch}</p>
      )}

      {isFreemail && (
        <p className="freemail-notice">{steps.company.freemailNotice}</p>
      )}

      {/* Create new company form */}
      <div className="section-title">{steps.company.createNew}</div>
      <div className="create-form">
        <InputGroup>
          <InputGroup.Text className="bg-white">
            <Icon className="text-primary" icon={faBuilding} fixedWidth />
          </InputGroup.Text>
          <Form.Control
            placeholder={steps.company.name}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
        </InputGroup>

        <InputGroup>
          <InputGroup.Text className="bg-white">
            <Icon className="text-primary" icon={faIdCard} fixedWidth />
          </InputGroup.Text>
          <Form.Control
            placeholder={steps.company.nit}
            value={companyNit}
            onChange={(e) => setCompanyNit(e.target.value)}
          />
        </InputGroup>

        {error && <Alert>{error}</Alert>}

        <Button onClick={handleCreate} disabled={loading}>
          {steps.company.create}
          {loading && <Spinner size="sm" />}
        </Button>
      </div>
    </Container>
  );
}

export default CompanyStep;
