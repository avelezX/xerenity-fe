'use client';

import { PropsWithChildren, MouseEventHandler, useRef, useState } from 'react';
import { Overlay, Tooltip } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import truncateStr from 'src/utils/truncateStr';
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
}: CardProps) => {
  const titleTarget = useRef(null);
  const [showeFullTitle, onShowTitle] = useState<boolean>(false);

  return (
    <CardContainer>
      <CardTitle>
        <div className="title-section">
          <Icon icon={icon} />
          <h5
            style={{ cursor: 'pointer' }}
            ref={titleTarget}
            onMouseEnter={() => onShowTitle(true)}
            onMouseLeave={() => onShowTitle(false)}
          >
            {truncateStr(title, 30)}
          </h5>
          <Overlay
            target={titleTarget.current}
            show={showeFullTitle}
            placement="top"
          >
            <Tooltip>{title}</Tooltip>
          </Overlay>
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
          <p>{truncateStr(description, 120)}</p>
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
};

export default Card;
