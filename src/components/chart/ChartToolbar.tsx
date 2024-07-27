'use clitent';

import { useState, useRef } from 'react';
import IconButton from '@components/UI/IconButton';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faCalendar,
  faImage,
  faMagnifyingGlassMinus,
} from '@fortawesome/free-solid-svg-icons';
import { Overlay, Tooltip } from 'react-bootstrap';

const DATE_TXT = 'Mostrar Fecha';
const ZOOM_TXT = 'Reiniciar Zoom';
const SCREENSHOT_TXT = 'Tomar Screenshot';

type ChartToolBarProps = {
  onDateAction: () => void;
  onZoomAction: () => void;
  onScreenshot: () => void;
};

const ChartToolBar = ({
  onDateAction,
  onZoomAction,
  onScreenshot,
}: ChartToolBarProps) => {
  const showYearTarget = useRef<HTMLDivElement | null>(null);
  const showZoomTarget = useRef<HTMLDivElement | null>(null);
  const showScreenshotTarget = useRef<HTMLDivElement | null>(null);
  const [showYearTooltip, onShowYearTooltip] = useState(false);
  const [showZoomTooltip, onShowZoomTooltip] = useState(false);
  const [showScreenshotTooltip, onShowScreenshotTooltip] = useState(false);
  return (
    <div>
      <div className="w-100 d-flex gap-3 justify-content-end mb-4">
        <IconButton onClick={() => onDateAction()}>
          <div
            ref={showYearTarget}
            onMouseEnter={() => onShowYearTooltip(true)}
            onMouseLeave={() => onShowYearTooltip(false)}
          >
            <Icon icon={faCalendar} />
          </div>
        </IconButton>
        <IconButton onClick={() => onZoomAction()}>
          <div
            ref={showZoomTarget}
            onMouseEnter={() => onShowZoomTooltip(true)}
            onMouseLeave={() => onShowZoomTooltip(false)}
          >
            <Icon icon={faMagnifyingGlassMinus} />
          </div>
        </IconButton>
        <IconButton onClick={() => onScreenshot()}>
          <div
            ref={showScreenshotTarget}
            onMouseEnter={() => onShowScreenshotTooltip(true)}
            onMouseLeave={() => onShowScreenshotTooltip(false)}
          >
            <Icon icon={faImage} />
          </div>
        </IconButton>
      </div>
      <Overlay
        target={showYearTarget.current}
        show={showYearTooltip}
        placement="bottom"
      >
        <Tooltip>{DATE_TXT}</Tooltip>
      </Overlay>
      <Overlay
        target={showZoomTarget.current}
        show={showZoomTooltip}
        placement="bottom"
      >
        <Tooltip>{ZOOM_TXT}</Tooltip>
      </Overlay>
      <Overlay
        target={showScreenshotTarget.current}
        show={showScreenshotTooltip}
        placement="bottom"
      >
        <Tooltip>{SCREENSHOT_TXT}</Tooltip>
      </Overlay>
    </div>
  );
};

export default ChartToolBar;
