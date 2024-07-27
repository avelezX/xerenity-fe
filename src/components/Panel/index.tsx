import { CSSProperties, PropsWithChildren } from 'react';
import PanelContainer from './PanelContainer.styled';

type PanelProps = {
  styles?: CSSProperties;
} & PropsWithChildren;

const Panel = ({ children, styles }: PanelProps) => (
  <PanelContainer style={styles}>{children}</PanelContainer>
);

export default Panel;
