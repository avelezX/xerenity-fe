import { LightSerie } from 'src/types/lightserie';
import useAppStore from '@store';
import IconButton from '@components/UI/IconButton';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';

type RowActionsProp = {
  serie: LightSerie;
};

const RowActions = ({ serie }: RowActionsProp) => {
  const { removeSelected } = useAppStore();

  return (
    <IconButton
      onClick={() => {
        removeSelected(serie);
      }}
    >
      <Icon icon={faTrash} />
    </IconButton>
  );
};

const SelectedSerieListColumns = [
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
