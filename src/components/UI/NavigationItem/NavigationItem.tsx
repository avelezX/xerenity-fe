import {
    IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { Nav } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';

export type TabNavigationItemProps = {
    name: string;
    onClick: () => void;
    icon: IconDefinition;
};

export default function TabNavigationItem (props: TabNavigationItemProps)  {
    
    const { icon, name,onClick } = props;

    return (
        <Nav.Item onClick={onClick}>
            <Nav.Link as='button'>
                <Icon className="mr-5" icon={icon} />
                {' '}
                <span>{name}</span>
            </Nav.Link>
        </Nav.Item>
    );
};
