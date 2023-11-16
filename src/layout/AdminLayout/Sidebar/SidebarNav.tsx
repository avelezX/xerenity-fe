import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  IconDefinition,
} from '@fortawesome/free-regular-svg-icons'
import {
  faInstitution,
  faChevronUp,
  faShoppingBasket,
  faDashboard,
  faLineChart
} from '@fortawesome/free-solid-svg-icons'
import React, {
  PropsWithChildren, useContext, useEffect, useState,
} from 'react'
import {
  Accordion, AccordionContext, Button, Nav, useAccordionButton,
} from 'react-bootstrap'
import classNames from 'classnames'
import Link from 'next/link'

type SidebarNavItemProps = {
  href: string;
  icon?: IconDefinition;
} & PropsWithChildren

const SidebarNavItem = (props: SidebarNavItemProps) => {
  const {
    icon,
    children,
    href,
  } = props

  return (
    <Nav.Item>
      <Link href={href} passHref legacyBehavior>
        <Nav.Link className="px-3 py-2 d-flex align-items-center">
          {icon ? <FontAwesomeIcon className="nav-icon ms-n3" icon={icon} />
            : <span className="nav-icon ms-n3" />}
          {children}
        </Nav.Link>
      </Link>
    </Nav.Item>
  )
}


type SidebarNavGroupToggleProps = {
  eventKey: string;
  icon: IconDefinition;
  setIsShow: (isShow: boolean) => void;
} & PropsWithChildren

const SidebarNavGroupToggle = (props: SidebarNavGroupToggleProps) => {
  // https://react-bootstrap.github.io/components/accordion/#custom-toggle-with-expansion-awareness
  const { activeEventKey } = useContext(AccordionContext)
  const {
    eventKey, icon, children, setIsShow,
  } = props

  const decoratedOnClick = useAccordionButton(eventKey)

  const isCurrentEventKey = activeEventKey === eventKey

  useEffect(() => {
    setIsShow(activeEventKey === eventKey)
  }, [activeEventKey, eventKey, setIsShow])

  return (
    <Button
      variant="link"
      type="button"
      className={classNames('rounded-0 nav-link px-3 py-2 d-flex align-items-center flex-fill w-100 shadow-none', {
        collapsed: !isCurrentEventKey,
      })}
      onClick={decoratedOnClick}
    >
      <FontAwesomeIcon className="nav-icon ms-n3" icon={icon} />
      {children}
      <div className="nav-chevron ms-auto text-end">
        <FontAwesomeIcon size="xs" icon={faChevronUp} />
      </div>
    </Button>
  )
}

type SidebarNavGroupProps = {
  toggleIcon: IconDefinition;
  toggleText: string;
} & PropsWithChildren

const SidebarNavGroup = (props: SidebarNavGroupProps) => {
  const {
    toggleIcon,
    toggleText,
    children,
  } = props

  const [isShow, setIsShow] = useState(false)

  return (
    <Accordion as="li" bsPrefix="nav-group" className={classNames({ show: isShow })}>
      <SidebarNavGroupToggle icon={toggleIcon} eventKey="0" setIsShow={setIsShow}>{toggleText}</SidebarNavGroupToggle>
      <Accordion.Collapse eventKey="0">
        <ul className="nav-group-items list-unstyled">
          {children}
        </ul>
      </Accordion.Collapse>
    </Accordion>
  )
}

export default function SidebarNav() {
  return (
    <ul className="list-unstyled">

      <SidebarNavItem icon={faDashboard}  href="/home">
            Dashboard            
      </SidebarNavItem>

      <SidebarNavGroup toggleIcon={faInstitution} toggleText="Tes">

        <SidebarNavItem icon={faLineChart}  href="/tes/daily">            
            <small className="ms-auto">Historical prices</small>
        </SidebarNavItem>

      </SidebarNavGroup>

      <SidebarNavGroup toggleIcon={faShoppingBasket} toggleText="Canasta">

        <SidebarNavItem icon={faLineChart}  href="/canasta/inflacion">            
            <small className="ms-auto">Inflacion</small>
        </SidebarNavItem>

        <SidebarNavItem icon={faLineChart}  href="/canasta/valores">            
            <small className="ms-auto">Valores</small>
        </SidebarNavItem>

      </SidebarNavGroup>

      <SidebarNavGroup toggleIcon={faInstitution} toggleText="Banrep">

        <SidebarNavItem icon={faLineChart}  href="/banrep">
            
            <small className="ms-auto">Series</small>
        </SidebarNavItem>

      </SidebarNavGroup>

      <SidebarNavGroup toggleIcon={faInstitution} toggleText="Series">
        <small>
          <SidebarNavItem icon={faLineChart}  href="/series">              
              <big className="ms-auto">Series</big>
          </SidebarNavItem>
        </small>
      </SidebarNavGroup>

    </ul>
  )
}
