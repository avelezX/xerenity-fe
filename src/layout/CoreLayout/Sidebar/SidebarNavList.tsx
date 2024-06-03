import { useState, useEffect } from 'react';
import {
  faChartSimple,
  faDollarSign,
  faLandmark,
  faLineChart,
  faMoneyBillTrendUp,
} from '@fortawesome/free-solid-svg-icons';
import SubNavItem from './SubNavItem';
import NavigationItem, { NavItemProps } from './NavigationItem';

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
    name: 'créditos',
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
    name: 'Inflacion',
    path: '/inflation',
    icon: faMoneyBillTrendUp,
    active: false,
  },
];

const MONEDAS_SUBNAV: NavItemProps[] = [
  {
    name: 'Peso Colombiano',
    path: '/currency/cop',
    icon: faDollarSign,
    active: false,
  },
  {
    name: 'Global',
    path: '/currency/global',
    icon: faDollarSign,
    active: false,
  },
];

const MONEDAS_PREFIX = '/currency';

const SidebarNavList = ({ currentPath }: SidebarNavProps) => {
  const [navLinks, setNavLinks] = useState<NavItemProps[]>([]);

  useEffect(() => {
    const links = NAV_ITEMS.map((item) => ({
      ...item,
      active: item.path.includes(currentPath),
    }));
    setNavLinks(links);
  }, [currentPath]);

  return (
    <ul className="sidebar-nav">
      {navLinks?.length > 0 &&
        navLinks.map(({ active, name, path, icon }) => (
          <NavigationItem
            active={active}
            name={name}
            path={path}
            icon={icon}
            key={`${name}${path}`}
          />
        ))}
      <SubNavItem
        name="Monedas"
        icon={faDollarSign}
        active={currentPath.includes(MONEDAS_PREFIX)}
      >
        {MONEDAS_SUBNAV.map(({ name, path, icon }) => (
          <NavigationItem
            active={currentPath.includes(path)}
            name={name}
            path={path}
            icon={icon}
            key={`${name}${path}`}
          />
        ))}
      </SubNavItem>
    </ul>
  );
};

export default SidebarNavList;
