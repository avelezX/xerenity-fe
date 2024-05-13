import { PropsWithChildren } from 'react';
import GridContainer from './GridContainer.styled';

const CardGrid = ({ children }: PropsWithChildren) => (
  <GridContainer>{children}</GridContainer>
);

export default CardGrid;
