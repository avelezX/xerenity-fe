'use client';

import { PropsWithChildren, MouseEventHandler, useRef, useState } from 'react';
import { Overlay, Tooltip, ToastContainer, Toast } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { XerenityHexColors } from 'src/utils/getHexColors';
import truncateStr from 'src/utils/truncateStr';
import Circle from '@uiw/react-color-circle';
import {
  CardTitle,
  CardContainer,
  CardBody,
  CardFooter,
  SourcePill,
} from './Card.styled';

import IconButton from '../IconButton';
import Button from '../Button';

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
  serieId: string;
  handleColorPicker?: (serieid: string, color: string) => void;
} & PropsWithChildren;

const Card = ({
  title,
  icon,
  color,
  actions,
  fuente,
  description,
  handleColorPicker,
  serieId,
}: CardProps) => {
  const titleTarget = useRef(null);
  const [showeFullTitle, onShowTitle] = useState<boolean>(false);
  const [showColorToast, setShowColorToast] = useState(false);

  const HandleColorSelect = async (newColor: {
    hex: React.SetStateAction<string>;
  }) => {
    if (handleColorPicker) {
      handleColorPicker(serieId, newColor.hex.toString());
    }
    setShowColorToast(false);
  };

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
      <ToastContainer>
        <Toast
          onClose={() => setShowColorToast(false)}
          show={showColorToast}
          animation
        >
          <Toast.Body>
            <Circle
              style={{ width: '100%', height: '100%' }}
              colors={XerenityHexColors}
              onChange={HandleColorSelect}
            />
          </Toast.Body>
        </Toast>
      </ToastContainer>
      <CardBody>
        <div className="picker">
          {color && (
            <Button
              onClick={() => setShowColorToast(true)}
              bg={color}
              $height="30px"
            />
          )}
        </div>
        <div className="description">
          <p>{truncateStr(description, 120)}</p>
        </div>
      </CardBody>

      {fuente && (
        <CardFooter>
          <SourcePill>
            {FUENTE_TXT}: {fuente}
          </SourcePill>
        </CardFooter>
      )}
    </CardContainer>
  );
};

export default Card;
