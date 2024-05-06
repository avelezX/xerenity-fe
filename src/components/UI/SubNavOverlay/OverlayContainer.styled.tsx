import styled from 'styled-components';
import tokens from 'design-tokens/tokens.json';

const OverlayContainer = styled.div`
  display: flex;
  flex-direction: column;
  background-color: white;
  border-radius: 8px;
  border: solid 1px #cecece;
  box-shadow: 2px 6px 10px 0px rgba(51, 51, 3, 0.2);
  z-index: 999;
  margin: 0 6px;

  .nav-item .nav-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;

    &:hover {
      color: ${tokens.xerenity['purple-200'].value};
    }
  }

  .nav-item.active .nav-link {
    background-color: ${tokens.xerenity['purple-10'].value};
    color: ${tokens.xerenity['purple-200'].value};
  }
`;

export default OverlayContainer;
