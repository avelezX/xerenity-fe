import { PropsWithChildren, MouseEventHandler } from 'react';
import IconButtonWrapper from './IconButton.styled';

type IconButtonProps = {
  onClick: MouseEventHandler<HTMLButtonElement>;
} & PropsWithChildren;

const IconButton = ({ children, onClick }: IconButtonProps) => (
  <IconButtonWrapper variant="outline-primary" onClick={onClick}>
    {children}
  </IconButtonWrapper>
);

export default IconButton;
