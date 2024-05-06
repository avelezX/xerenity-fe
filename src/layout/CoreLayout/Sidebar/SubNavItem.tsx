import { useState, useRef, PropsWithChildren } from 'react';
import { Nav, NavItem } from 'react-bootstrap';
import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import SubNavOverlay from '@components/UI/SubNavOverlay';

type NavItemPropsOverlay = {
  name: string;
  icon: IconDefinition;
  active: boolean;
} & PropsWithChildren;

const SubNavItem = (props: NavItemPropsOverlay) => {
  const { active, icon, name, children } = props;
  const [show, setShow] = useState(false);
  const target = useRef<HTMLDivElement>(null);
  return (
    <>
      <SubNavOverlay target={target} show={show} onHide={() => setShow(false)}>
        {children}
      </SubNavOverlay>
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

export default SubNavItem;
