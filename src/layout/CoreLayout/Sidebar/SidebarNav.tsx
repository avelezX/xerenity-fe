import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Nav, NavItem } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faChartSimple,
  faLandmark,
  IconDefinition,
  faLineChart,
  faMoneyBill,
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
    path: '/tes',
    icon: faLineChart,
    active: false,
  },
  {
    name: 'monedas',
    path: '/currency',
    icon: faMoneyBill,
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
  const router = useRouter();
  const [activePath, setActivePath] = useState('');

  useEffect(() => {
    setActivePath(currentPath);
  }, [currentPath]);

  const checkActivePaths = ({ path }: NavItemProps) => path === router.pathname;

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
