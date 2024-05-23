import styled from 'styled-components';
import tokens from 'design-tokens/tokens.json';

const designSystem = tokens.xerenity;
const PRIMARY_COLOR = designSystem['purple-200'].value;
const LIGHT_PURPLE = designSystem['purple-10'].value;
const TEXT_MD = designSystem['text-md'].value;
const SEMI_BOLD = designSystem['semi-bold'].value;

const ModalContent = styled.div`
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

export default ModalContent;
