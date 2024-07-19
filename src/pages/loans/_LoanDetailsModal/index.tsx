import { Loan } from 'src/types/loans';
import styled from 'styled-components';
import currencyFormat from 'src/utils/currencyFormat';
import tokens from 'design-tokens/tokens.json';
import { CSSProperties } from 'react';

import { ExpanderComponentProps } from 'react-data-table-component';
import Alert from '@components/UI/Alert';

const designSystem = tokens.xerenity;
const WEIGHT_MD = designSystem.medium.value;

const valueStyles: CSSProperties = {
  fontWeight: WEIGHT_MD,
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

const BALANCE_TXT = 'Balance Original:';
const PERIODICIDAD_TXT = 'Periodicidad:';
const INTERES_TXT = 'Interés:';
const GRACE_PERIOD = 'Periodo de gracia:';
const GRACE_TYPE = 'Tipo de gracia:';
const MIN_PERIOD_RATE = 'Tasa minima por periodo:';
const NUMBER_OF_PAYMENTS = 'Número de pagos:';
const DAYS_COUNT = 'Conteo de días:';
const START_DATE = 'Fecha de inicio:';
const LOAN_IDENTIFIER = 'Identificador credito:';

const getDaysCount = (interest: string) => {
  switch (interest) {
    case 'por_dias_360':
      return '30/360';
    case 'por_dias_365':
      return 'Act/365';
    default:
      // Text when 'fija' option is selected
      return 'Por Periodo';
  }
};

const ExpandedComponent: React.FC<ExpanderComponentProps<Loan>> = ({
  data,
}) => (
  <Alert variant="info">
    <div className="info-description">
      <div className="d-flex flex-column justify-content-center">
        {data?.loan_identifier && (
          <ItemDetail>
            <h6>{LOAN_IDENTIFIER}</h6>
            <span style={valueStyles}>{data?.loan_identifier}</span>
          </ItemDetail>
        )}
        <ItemDetail>
          <h6>{START_DATE}</h6>
          <span style={valueStyles}>{data?.start_date}</span>
        </ItemDetail>
        <ItemDetail>
          <h6>{BALANCE_TXT}</h6>
          <span style={valueStyles}>
            {data ? currencyFormat(data.original_balance) : ''}
          </span>
        </ItemDetail>
        <ItemDetail>
          <h6>{PERIODICIDAD_TXT}</h6>
          <span style={valueStyles}>{data?.periodicity}</span>
        </ItemDetail>
        <ItemDetail>
          <h6>{INTERES_TXT}</h6>
          <span style={valueStyles}>{`${data?.interest_rate}%`}</span>
        </ItemDetail>
        <ItemDetail>
          <h6>{NUMBER_OF_PAYMENTS}</h6>
          <span style={valueStyles}>{data?.number_of_payments}</span>
        </ItemDetail>
        {data?.grace_period && (
          <ItemDetail>
            <h6>{GRACE_PERIOD}</h6>
            <span style={valueStyles}>{data?.grace_period}</span>
          </ItemDetail>
        )}
        {data?.grace_type && (
          <ItemDetail>
            <h6>{GRACE_TYPE}</h6>
            <span style={valueStyles}>{data?.grace_type}</span>
          </ItemDetail>
        )}
        {data?.min_period_rate && (
          <ItemDetail>
            <h6>{MIN_PERIOD_RATE}</h6>
            <span style={valueStyles}>{data?.min_period_rate}</span>
          </ItemDetail>
        )}
        {data?.days_count && (
          <ItemDetail>
            <h6>{DAYS_COUNT}</h6>
            <span style={valueStyles}>{getDaysCount(data?.days_count)}</span>
          </ItemDetail>
        )}
      </div>
    </div>
  </Alert>
);

export default ExpandedComponent;
