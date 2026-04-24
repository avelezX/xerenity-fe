import { useState, useEffect } from 'react';
import {
  faChartSimple,
  faDollarSign,
  faLandmark,
  faLineChart,
  faMoneyBillTrendUp,
  faHome,
  faCalculator,
  faBriefcase,
  faScaleBalanced,
  faChartArea,
  faChartPie,
  faCog,
  faRobot,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import useAppStore from 'src/store';
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
  /* Old series page — replaced by market dashboards (SUAMECA, Tasas, Monedas, FIC)
  {
    name: 'series',
    path: '/series',
    icon: faChartSimple,
    active: false,
  },
  */
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

const RIESGOS_SUBNAV: NavItemProps[] = [
  { name: 'Resumen', path: '/risk-resumen', icon: faChartPie, active: false },
  { name: 'Exposición', path: '/risk-management', icon: faChartArea, active: false },
  { name: 'Créditos', path: '/loans', icon: faLandmark, active: false },
  { name: 'Portafolio OTC', path: '/portfolio', icon: faBriefcase, active: false },
  { name: 'NDF Pricer', path: '/ndf-pricer', icon: faCalculator, active: false },
  { name: 'IBR Swap', path: '/ibr-swap', icon: faLineChart, active: false },
  { name: 'XCCY Swap', path: '/xccy-swap', icon: faLineChart, active: false },
  { name: 'COLTES', path: '/coltes-calculator', icon: faCalculator, active: false },
  { name: 'Portafolio TES', path: '/tes-portfolio', icon: faLandmark, active: false },
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

const SERIES_DASHBOARDS_PREFIX = ['/suameca', '/tasas', '/monedas-dashboard', '/fic', '/par-monedas', '/cds-sovereign'];

const MONEDAS_PREFIX = '/currency';

const SidebarNavList = ({ currentPath }: SidebarNavProps) => {
  const [navLinks, setNavLinks] = useState<NavItemProps[]>([]);
  const userProfile = useAppStore((s) => s.userProfile);
  const userRole = userProfile?.role;

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
      {(userRole === 'super_admin' || userRole === 'corp_admin') && (
      <SubNavItem
        name="Riesgos"
        icon={faScaleBalanced}
        active={
          currentPath.includes('/risk-management') ||
          currentPath.includes('/loans') ||
          currentPath.includes('/ndf-pricer') ||
          currentPath.includes('/ibr-swap') ||
          currentPath.includes('/xcxy-swap') ||
          currentPath.includes('/portfolio') ||
          currentPath.includes('/coltes-calculator') ||
          currentPath.includes('/tes-portfolio')
        }
      >
        {RIESGOS_SUBNAV.map(({ name, path, icon }) => (
          <NavigationItem
            active={currentPath.includes(path)}
            name={name}
            path={path}
            icon={icon}
            key={`${name}${path}`}
          />
        ))}
      </SubNavItem>
      )}
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
      <NavigationItem
        name="Series"
        path="/suameca"
        icon={faChartSimple}
        active={SERIES_DASHBOARDS_PREFIX.some((p) => currentPath.includes(p))}
      />
      {(userRole === 'super_admin' || userRole === 'corp_admin') && (
        <NavigationItem
          name="Usuarios"
          path="/settings/users"
          icon={faUsers}
          active={currentPath.includes('/settings/users')}
        />
      )}
      {userRole === 'super_admin' && (
        <NavigationItem
          name="Admin"
          path="/admin"
          icon={faCog}
          active={currentPath === '/admin'}
        />
      )}
      {userRole === 'super_admin' && (
        <NavigationItem
          name="Agente IA"
          path="/admin/agent"
          icon={faRobot}
          active={currentPath === '/admin/agent'}
        />
      )}
    </ul>
  );
};

export default SidebarNavList;
