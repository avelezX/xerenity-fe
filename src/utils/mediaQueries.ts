import { css, CSSProp } from 'styled-components';

const SIZE = {
  mobile: '480px',
  tablet: '768px',
  laptop: '1000px',
  desktop: '2560px',
};

export const mobile = (inner: CSSProp) => css`
  @media (max-width: ${SIZE.mobile}) {
    ${inner};
  }
`;
export const tablet = (inner: CSSProp) => css`
  @media (max-width: ${SIZE.tablet}) {
    ${inner};
  }
`;
export const desktop = (inner: CSSProp) => css`
  @media (max-width: ${SIZE.desktop}) {
    ${inner};
  }
`;
export const laptop = (inner: CSSProp) => css`
  @media (max-width: ${SIZE.laptop}) {
    ${inner};
  }
`;
