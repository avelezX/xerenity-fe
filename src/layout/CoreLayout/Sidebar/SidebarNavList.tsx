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
  faHeartPulse,
  faBook,
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

// Items con `divider: true` se renderizan como cabeceras de seccion (no
// navegables) — agrupan visualmente los entries por workflow del trader:
//   1. Panorama: ver donde estoy
//   2. Posiciones: que tengo
//   3. Calculadoras: como pricear
//   4. Mercado: datos de referencia
type RiesgosNavItem = NavItemProps | { divider: true; name: string };

const RIESGOS_SUBNAV: RiesgosNavItem[] = [
  { name: 'Resumen', path: '/risk-resumen', icon: faChartPie, active: false },

  { divider: true, name: 'POSICIONES' },
  { name: 'Commodities', path: '/risk-management', icon: faChartArea, active: false },
  { name: 'Monitor Futuros', path: '/futures-monitor', icon: faLineChart, active: false },
  { name: 'Portafolio OTC', path: '/portfolio', icon: faBriefcase, active: false },
  { name: 'Créditos', path: '/loans', icon: faLandmark, active: false },
  { name: 'Portafolio TES', path: '/tes-portfolio', icon: faLandmark, active: false },

  { divider: true, name: 'CALCULADORAS' },
  { name: 'NDF Pricer', path: '/ndf-pricer', icon: faCalculator, active: false },
  { name: 'IBR Swap', path: '/ibr-swap', icon: faLineChart, active: false },
  { name: 'XCCY Swap', path: '/xccy-swap', icon: faLineChart, active: false },
  { name: 'COLTES', path: '/coltes-calculator', icon: faCalculator, active: false },
  { name: 'USDCOP', path: '/usdcop-calculator', icon: faCalculator, active: false },

  { divider: true, name: 'DATOS DE MERCADO' },
  { name: 'Marcas', path: '/marks', icon: faBook, active: false },
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
          currentPath.includes('/risk-resumen') ||
          currentPath.includes('/risk-management') ||
          currentPath.includes('/futures-monitor') ||
          currentPath.includes('/loans') ||
          currentPath.includes('/ndf-pricer') ||
          currentPath.includes('/ibr-swap') ||
          currentPath.includes('/xccy-swap') ||
          currentPath.includes('/portfolio') ||
          currentPath.includes('/coltes-calculator') ||
          currentPath.includes('/tes-portfolio') ||
          currentPath.includes('/usdcop-calculator') ||
          currentPath.includes('/marks')
        }
      >
        {RIESGOS_SUBNAV.map((item) => {
          if ('divider' in item) {
            return (
              <li
                key={`divider-${item.name}`}
                style={{
                  padding: '14px 18px 4px',
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              >
                {item.name}
              </li>
            );
          }
          return (
            <NavigationItem
              active={currentPath.includes(item.path)}
              name={item.name}
              path={item.path}
              icon={item.icon}
              key={`${item.name}${item.path}`}
            />
          );
        })}
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
      <NavigationItem
        name="Catálogo"
        path="/data-catalog"
        icon={faBook}
        active={currentPath.includes('/data-catalog')}
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
          name="Monitor"
          path="/admin/monitor"
          icon={faHeartPulse}
          active={currentPath.includes('/admin/monitor')}
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
