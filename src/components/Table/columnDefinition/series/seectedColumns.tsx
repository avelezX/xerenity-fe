import { LightSerie } from 'src/types/lightserie';
import useAppStore from '@store';
import IconButton from '@components/UI/IconButton';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import {
  faAlignLeft,
  faAlignRight,
  faClipboard,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import Button from '@components/UI/Button';

type RowActionsProp = {
  serie: LightSerie;
};

const ColorChange = ({ serie }: RowActionsProp) => {
  const { setShowSerieColor, setCurrentSerie } = useAppStore();

  return (
    <Button
      onClick={() => {
        setCurrentSerie(serie.tiker);
        setShowSerieColor(true);
      }}
      bg={serie.color}
    />
  );
};

const RowActions = ({ serie }: RowActionsProp) => {
  const { removeSelected, handleAxisChnage } = useAppStore();

  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      <IconButton onClick={() => removeSelected(serie)}>
        <Icon icon={faTrash} />
      </IconButton>
      <IconButton onClick={() => handleAxisChnage(serie)}>
        <Icon icon={serie.axisName === 'left' ? faAlignLeft : faAlignRight} />
      </IconButton>
      <IconButton
        onClick={() => {
          navigator.clipboard.writeText(serie.tiker);
          toast.info('Ticker copiado al portapapeles', {
            position: toast.POSITION.BOTTOM_RIGHT,
          });
        }}
      >
        <Icon icon={faClipboard} />
      </IconButton>
    </div>
  );
};

const SelectedSerieListColumns = [
  {
    name: 'Color',
    cell: (row: LightSerie) => <ColorChange serie={row} />,
    maxWidth: '1rem',
  },
  {
    name: 'Nombre',
    selector: (row: LightSerie) => row.name,
    sortable: true,
  },
  {
    name: 'Acciones',
    cell: (row: LightSerie) => <RowActions serie={row} />,
  },
];

export default SelectedSerieListColumns;
