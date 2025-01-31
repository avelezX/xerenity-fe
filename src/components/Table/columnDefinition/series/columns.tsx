import IconButton from '@components/UI/IconButton';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faEye } from '@fortawesome/free-solid-svg-icons';
import { LightSerieEntry } from 'src/types/lightserie';
import useAppStore from '@store';

type ViewSerieActionProps = {
  serie: LightSerieEntry;
};

const ViewSerie = ({ serie }: ViewSerieActionProps) => {
  const { setShowSerieModal, setCurrentSerie } = useAppStore();
  return (
    <IconButton
      onClick={() => {
        setCurrentSerie(serie.ticker);
        setShowSerieModal(true);
      }}
    >
      <Icon icon={faEye} />
    </IconButton>
  );
};

const SerieListColumns = [
  {
    name: 'Nombre',
    selector: (row: LightSerieEntry) => row.display_name,
    sortable: true,
    wrap: true,
    grow: 3,
  },
  {
    name: 'Grupo',
    selector: (row: LightSerieEntry) => row.grupo,
    sortable: true,
    grow: 1,
    wrap: true,
  },
  {
    name: 'Sub grupo',
    selector: (row: LightSerieEntry) => row.sub_group,
    sortable: true,
    wrap: true,
    grow: 3,
  },
  {
    name: 'Fuente',
    selector: (row: LightSerieEntry) => row.fuente,
    sortable: true,
  },
  {
    name: 'Acciones',
    cell: (row: LightSerieEntry) => <ViewSerie serie={row} />,
    compact: true,
    maxWidth: '5rem',
  },
];

export default SerieListColumns;
