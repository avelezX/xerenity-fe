import { useState, useEffect } from 'react';
import {
  faChartSimple,
  faDollarSign,
  faLandmark,
  faLineChart,
  faMoneyBillTrendUp,
  faHome,
  faCalculator,
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
    icon: faHome,
    active: false,
  },
  {
    name: 'series',
    path: '/series',
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
    name: 'TasasCOP',
    path: '/tes',
    icon: faLineChart,
    active: false,
  },
  {
    name: 'TasasUSD',
    path: '/us-rates',
    icon: faDollarSign,
    active: false,
  },
  {
    name: 'Inflación',
    path: '/inflation',
    icon: faMoneyBillTrendUp,
    active: false,
  },
  {
    name: 'COP NDF',
    path: '/copndf',
    icon: faLandmark,
    active: false,
  },
];

const PRICING_SUBNAV: NavItemProps[] = [
  {
    name: 'NDF Pricer',
    path: '/ndf-pricer',
    icon: faCalculator,
    active: false,
  },
  {
    name: 'IBR Swap',
    path: '/ibr-swap',
    icon: faLineChart,
    active: false,
  },
  {
    name: 'XCCY Swap',
    path: '/xccy-swap',
    icon: faLineChart,
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

const MERCADOS_SUBNAV: NavItemProps[] = [
  {
    name: 'SUAMECA',
    path: '/suameca',
    icon: faLandmark,
    active: false,
  },
  {
    name: 'Tasas',
    path: '/tasas',
    icon: faLineChart,
    active: false,
  },
  {
    name: 'Monedas',
    path: '/monedas-dashboard',
    icon: faDollarSign,
    active: false,
  },
  {
    name: 'FIC',
    path: '/fic',
    icon: faChartSimple,
    active: false,
  },
];

const MERCADOS_PREFIX = ['/suameca', '/tasas', '/monedas-dashboard', '/fic'];

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
        name="Pricing"
        icon={faCalculator}
        active={currentPath.includes('/ndf-pricer') || currentPath.includes('/ibr-swap') || currentPath.includes('/xccy-swap')}
      >
        {PRICING_SUBNAV.map(({ name, path, icon }) => (
          <NavigationItem
            active={currentPath.includes(path)}
            name={name}
            path={path}
            icon={icon}
            key={`${name}${path}`}
          />
        ))}
      </SubNavItem>
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
      <SubNavItem
        name="Mercados"
        icon={faChartSimple}
        active={MERCADOS_PREFIX.some((p) => currentPath.includes(p))}
      >
        {MERCADOS_SUBNAV.map(({ name, path, icon }) => (
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
