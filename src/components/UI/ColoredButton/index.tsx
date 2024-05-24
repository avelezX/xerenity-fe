import { MouseEventHandler } from 'react';
import ColoredButtonWrapper from './ColoredButton.styled';

type ColoredButtonProps = {
  onClick: MouseEventHandler<HTMLButtonElement>;
  color:string;
}

const ColoredButton = ({ onClick,color }: ColoredButtonProps) => (
  <ColoredButtonWrapper color={color} onClick={onClick}/>
);

export default ColoredButton;
