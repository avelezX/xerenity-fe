import { Image as BsImage, ImageProps as BsImageProps } from 'react-bootstrap';
import { FC } from 'react';

import styled from 'styled-components';

interface ImageProps extends BsImageProps {
  $fullwidth?: boolean;
}

const Image: FC<ImageProps> = styled(BsImage)`
  width: ${(props) => (props.$fullwidth ? '100%' : 'auto')};
`;

export default Image;
