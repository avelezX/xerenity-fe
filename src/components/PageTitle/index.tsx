import styled from 'styled-components';
import tokens from 'design-tokens/tokens.json';

const designSystem = tokens.xerenity;

const PageTitle = styled.div`
  display: flex;
  align-items: center;
  padding: 10px 0;
  gap: 8px;

  h4 {
    color: ${designSystem['purple-300'].value};
    font-size: 22px;
    margin-bottom: 0 !important;
  }

  svg,
  path {
    fill: ${designSystem['purple-300'].value};
  }
`;

export default PageTitle;
