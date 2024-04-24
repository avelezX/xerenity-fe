import styled from 'styled-components';
import tokens from 'design-tokens/tokens.json';

const designSystem = tokens.xerenity;

const ToolbarContainer = styled.div`
  width: auto;
  display: flex;
  gap: 8px;
  border-radius: ${designSystem['radius-md'].value}px;
`;

export default ToolbarContainer;
