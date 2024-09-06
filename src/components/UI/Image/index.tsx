import { Image as BsImage, ImageProps as BsImageProps } from 'react-bootstrap';

import styled from 'styled-components';

interface ImageProps extends BsImageProps {
  $fullwidth?: boolean;
}

const Image = styled(BsImage)<ImageProps>`
  width: ${(props) => (props.$fullwidth ? '100%' : 'auto')};
`;

export default Image;
