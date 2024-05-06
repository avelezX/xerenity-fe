import { useRouter } from 'next/router';
import { Nav, NavItem } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/free-solid-svg-icons';

export type NavItemProps = {
  name: string;
  path: string;
  icon: IconDefinition;
  active: boolean;
};

const NavigationItem = (props: NavItemProps) => {
  const router = useRouter();
  const { active, icon, name, path } = props;
  return (
    <NavItem
      className={active ? 'active' : ''}
      onClick={() => router.push(path)}
    >
      <Nav.Link>
        <Icon className="mr-5" icon={icon} />
        <span>{name}</span>
      </Nav.Link>
    </NavItem>
  );
};

export default NavigationItem;
