import styled from 'styled-components';
import { tablet } from 'src/utils/mediaQueries';

const SocialAuthContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 50%;
  gap: 16px;

  ${tablet(`
    width: 100%;
  `)}

  .divider {
    display: flex;
    align-items: center;
    width: 100%;
    gap: 12px;

    &::before,
    &::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #dedede;
    }

    span {
      font-size: 12px;
      color: #8e8e8e;
      white-space: nowrap;
    }
  }

  .social-buttons {
    display: flex;
    gap: 12px;
    width: 100%;
    justify-content: center;
  }

  .social-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 20px;
    border: 1px solid #dedede;
    border-radius: 8px;
    background: white;
    font-size: 13px;
    font-weight: 500;
    color: #333;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
    flex: 1;

    &:hover {
      background: #f8f8f8;
      border-color: #bbb;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    svg {
      flex-shrink: 0;
    }
  }
`;

export default SocialAuthContainer;
