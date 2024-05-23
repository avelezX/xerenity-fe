import { PropsWithChildren } from 'react';
import PanelContainer from './PanelContainer.styled';

const Panel = ({ children }: PropsWithChildren) => (
  <PanelContainer>{children}</PanelContainer>
);

export default Panel;
