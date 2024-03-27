import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import styled from 'styled-components';

export type ToolbarItemProps = {
  name: string;
  onClick: () => void;
  icon: IconDefinition;
  className?: string;
};

const ItemLink = styled.a`
  display: flex;
  gap: 6px;
  align-items: center;
  text-decoration: none;
  cursor: pointer;
`;

const ToolbarItem = ({ className, icon, name, onClick }: ToolbarItemProps) => (
  <ItemLink className={className} onClick={onClick}>
    <Icon icon={icon} /> <span>{name}</span>
  </ItemLink>
);

export default ToolbarItem;
