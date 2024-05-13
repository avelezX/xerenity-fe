import {
  Card as BsCard,
  CardTitle as BsCardTitle,
  CardBody as BsCardBody,
  CardFooter as BsCardFooter,
} from 'react-bootstrap';
import styled from 'styled-components';
import tokens from 'design-tokens/tokens.json';

const designSystem = tokens.xerenity;
const SM_RADIUS = designSystem['radius-sm'].value;
const LG_RADIUS = designSystem['radius-lg'].value;
const PRIMARY_COLOR = designSystem['purple-200'].value;
const LIGHT_PURPLE = designSystem['purple-10'].value;
const FONT_MEDIUM = designSystem.medium.value;
const GRAY_500 = designSystem['gray-500'].value;

export const CardContainer = styled(BsCard)`
  min-width: 349px;
  width: 100%;
  display: flex;
  background-color: white;
  border-radius: ${LG_RADIUS}px !important;
`;

export const CardTitle = styled(BsCardTitle)`
  display: flex;
  width: 100%;
  gap: 5px;
  align-items: center;
  justify-content: space-between;
  background-color: ${LIGHT_PURPLE};
  padding: 8px 13px;
  border-radius: ${LG_RADIUS}px !important;

  h5 {
    margin-bottom: 0;
    color: ${PRIMARY_COLOR};
  }

  path,
  rect {
    fill: ${PRIMARY_COLOR};
  }

  .title-section {
    align-items: center;
    display: flex;
    gap: 10px;

    &:last-child {
      gap: 16px;
    }
  }
`;

export const CardBody = styled(BsCardBody)`
  display: flex;
  gap: 10px;
  padding: 10px 18px 18px 18px;
  .picker {
    max-width: 26px;
    flex: 1 1 auto;
  }
  .description {
    flex: 2 1 auto;
  }
`;

export const ColorPicker = styled.div<{ color: string }>`
  width: 26px;
  height: 26px;
  flex: 1 1 auto;
  background-color: ${(props) => props.color};
  border-radius: ${SM_RADIUS}px;
`;

export const CardFooter = styled(BsCardFooter)`
  display: flex;
  border-top: 0;
  justify-content: center;
  background-color: white;
  padding-top: 0;
`;

export const SourcePill = styled.span`
  border-radius: 100px;
  padding: 5px 15px;
  background-color: ${LIGHT_PURPLE};
  font-weight: ${FONT_MEDIUM};
  color: ${GRAY_500};
`;
