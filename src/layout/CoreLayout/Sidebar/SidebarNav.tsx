import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Nav, NavItem } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faChartSimple,
  faLandmark,
  IconDefinition,
  faLineChart,
} from '@fortawesome/free-solid-svg-icons';

type NavItemProps = {
  name: string;
  path: string;
  icon: IconDefinition;
  active: boolean;
};

type SidebarNavProps = {
  currentPath: string;
};

const NAV_ITEMS: NavItemProps[] = [
  {
    name: 'dashboard',
    path: '/dashboard',
    icon: faChartSimple,
    active: false,
  },
  {
    name: 'creditos',
    path: '/loans',
    icon: faLandmark,
    active: false,
  },
  {
    name: 'Tasas COP',
    path: '/tes/daily',
    icon: faLineChart,
    active: false,
  },
  {
    name: 'Prueba',
    path: '/panel',
    icon: faLineChart,
    active: false,
  },
];

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

const SidebarNav = ({ currentPath }: SidebarNavProps) => {
  const [activePath, setActivePath] = useState('');

  useEffect(() => {
    setActivePath(currentPath);
  }, [currentPath]);

  const checkActivePaths = ({ name }: NavItemProps) => {
    // TODO: Find a better scalable solution for mixed lang in the future
    if (activePath.includes('loans') && name === 'creditos') {
      return true;
    }
    return activePath.includes(name);
  };

  return (
    <ul className="sidebar-nav">
      {NAV_ITEMS.map((item) => (
        <NavigationItem
          active={checkActivePaths(item)}
          icon={item.icon}
          name={item.name}
          path={item.path}
          key={item.name}
        />
      ))}
    </ul>
  );
};

export default SidebarNav;
