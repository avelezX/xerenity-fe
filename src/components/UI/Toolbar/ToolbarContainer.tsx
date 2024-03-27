import styled from 'styled-components';
import tokens from 'design-tokens/tokens.json';

const designSystem = tokens.xerenity;

const ToolbarContainer = styled.div`
  display: flex;
  background-color: ${designSystem['white-100'].value};
  border-radius: ${designSystem['radius-md'].value}px;
  border: solid 1px ${designSystem['gray-200'].value};

  .toolbar-items {
    display: flex;
    width: 100%;
    height: 100%;
    justify-content: space-between;
    padding: 0 15px;

    .section {
      display: flex;
      align-items: center;
      gap: 20px;
    }
  }
`;

export default ToolbarContainer;
