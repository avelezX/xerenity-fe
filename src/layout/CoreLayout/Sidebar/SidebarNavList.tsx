import { useState, useEffect, useRef, PropsWithChildren } from 'react';
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
import Overlay from 'react-bootstrap/Overlay';
import Popover from 'react-bootstrap/Popover';

type NavItemProps = {
  name: string;
  path: string;
  icon: IconDefinition;
  active: boolean;
};


type NavItemPropsOverlay = {
  name: string;
  icon: IconDefinition;
  active: boolean;
}&PropsWithChildren;

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
  }
];

const NAV_ITEMS_OVERLAY: NavItemProps[] = [
  {
    name: 'USD:COP',
    path: '/currency/cop',
    icon: faMoneyBill,
    active: false,
  },
  {
    name: 'monedas',
    path: '/currency/global',
    icon: faMoneyBill,
    active: false,
  }
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


const NavigationItemOverlay = (props: NavItemPropsOverlay) => {
  const { active, icon, name, children } = props;
  const [show, setShow] = useState(false);
  const target = useRef(null);
  return (
    <>
      <Overlay target={target.current} show={show} placement="right">
        <Popover id="popover-basic">
          <Popover.Header as="h3">{name}</Popover.Header>
          <Popover.Body>
            {children}
          </Popover.Body>
        </Popover>
      </Overlay>
    <NavItem
      className={active ? 'active' : ''}
      ref={target}
      onClick={() => setShow(!show)}
    >
      <Nav.Link>
        <Icon className="mr-5" icon={icon} />
        <span>{name}</span>
      </Nav.Link>
    </NavItem>
    </>
  );
};


const SidebarNavList = ({ currentPath }: SidebarNavProps) => {
  const [navLinks, setNavLinks] = useState<NavItemProps[]>([]);

  useEffect(() => {
    const links = NAV_ITEMS.map((item) => ({
      ...item,
      active: item.path === currentPath,
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
        <NavigationItemOverlay 
          name='Monedas'
          icon={faMoneyBill} 
          active={false}        
        >
        {NAV_ITEMS_OVERLAY?.length > 0 &&
          NAV_ITEMS_OVERLAY.map(({ active, name, path, icon }) => (          
            <>
          <NavigationItem
            active={active}
            name={name}
            path={path}
            icon={icon}
            key={`${name}${path}`}
          />
          <hr/>
          </>
        ))}
        </NavigationItemOverlay>
    </ul>
  );
};

export default SidebarNavList;
