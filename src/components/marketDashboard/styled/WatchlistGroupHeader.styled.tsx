import styled from 'styled-components';
import tokens from 'design-tokens/tokens.json';

const designSystem = tokens.xerenity;

export const GroupHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  background: ${designSystem['beige-50'].value};
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid #e0e0e0;

  .group-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: ${designSystem['purple-300'].value};
    letter-spacing: 0.5px;
  }

  .group-meta {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .group-count {
    font-size: 10px;
    background: ${designSystem['purple-200'].value};
    color: white;
    border-radius: 10px;
    padding: 1px 7px;
    font-weight: 500;
  }

  .group-toggle {
    font-size: 10px;
    color: #999;
    transition: transform 0.2s;
  }

  .group-toggle.collapsed {
    transform: rotate(-90deg);
  }
`;

export const GroupColumnHeaders = styled.div`
  display: grid;
  grid-template-columns: 1fr 80px 70px 60px;
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 600;
  color: #999;
  text-transform: uppercase;
  border-bottom: 1px solid #e0e0e0;
  padding-left: 11px;

  span:not(:first-child) {
    text-align: right;
  }
`;
