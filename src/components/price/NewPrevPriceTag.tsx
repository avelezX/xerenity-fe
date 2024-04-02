'use client';

import { Stack } from 'react-bootstrap';
import React, { PropsWithChildren, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowDown, faArrowUp } from '@fortawesome/free-solid-svg-icons';
import tokens from 'design-tokens/tokens.json';
import Badge from '@components/UI/Badge';

const designSystem = tokens.xerenity;
const SUCCESS_COLOR = designSystem['green-500'].value;
const DANGER_COLOR = designSystem['red-600'].value;

type NewPrevProps = {
  current: number;
  prev: number;
} & PropsWithChildren;

const NewPrevTag = ({ current, prev, children }: NewPrevProps) => {
  const [bg, setBackground] = useState<string>(SUCCESS_COLOR);
  const [icon, setIcon] = useState(faArrowDown);

  useEffect(() => {
    if (current - prev <= 0) {
      return;
    }
    setBackground(DANGER_COLOR);
    setIcon(faArrowUp);
  }, [current, prev]);

  return (
    <Badge bg={bg}>
      <Stack gap={1} direction="horizontal">
        <FontAwesomeIcon icon={icon} />
        {children}
      </Stack>
    </Badge>
  );
};

export default NewPrevTag;
