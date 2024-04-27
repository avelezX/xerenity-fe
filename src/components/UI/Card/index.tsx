import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { PropsWithChildren, MouseEventHandler } from 'react';
import {
  CardTitle,
  CardContainer,
  CardBody,
  ColorPicker,
  CardFooter,
} from './Card.styled';
import IconButton from '../IconButton';

const FUENTE_TXT = 'Fuente';

type CardAction = {
  actionIcon: IconDefinition;
  actionEvent: MouseEventHandler<HTMLButtonElement>;
  name: string;
};

type CardProps = {
  title: string;
  icon: IconDefinition;
  color?: string;
  actions: CardAction[];
  fuente: string;
  description: string;
} & PropsWithChildren;

const Card = ({
  title,
  icon,
  color,
  actions,
  fuente,
  description,
}: CardProps) => (
  <CardContainer>
    <CardTitle>
      <div className="title-section">
        <Icon icon={icon} />
        <h5>{title}</h5>
      </div>
      <div className="title-section">
        {actions.map(({ name, actionIcon, actionEvent }) => (
          <IconButton key={name} onClick={actionEvent}>
            <Icon icon={actionIcon} />
          </IconButton>
        ))}
      </div>
    </CardTitle>
    <CardBody>
      <div className="picker">{color && <ColorPicker color={color} />}</div>
      <div className="description">
        <p>{description}</p>
      </div>
    </CardBody>
    {fuente && (
      <CardFooter>
        <span>
          {FUENTE_TXT}: {fuente}
        </span>
      </CardFooter>
    )}
  </CardContainer>
);

export default Card;
