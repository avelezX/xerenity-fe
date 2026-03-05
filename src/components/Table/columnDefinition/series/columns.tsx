import IconButton from '@components/UI/IconButton';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faEye } from '@fortawesome/free-solid-svg-icons';
import { LightSerieEntry } from 'src/types/lightserie';
import useAppStore from '@store';
import { getGroupColor } from 'src/utils/groupConstants';

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

const GroupBadge = ({ grupo }: { grupo: string }) => {
  const color = getGroupColor(grupo);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        backgroundColor: `${color}18`,
        border: `1px solid ${color}40`,
        borderRadius: '100px',
        padding: '2px 8px',
        fontSize: '12px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          backgroundColor: color,
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
      {grupo}
    </span>
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
    name: 'Ticker',
    selector: (row: LightSerieEntry) => row.ticker,
    sortable: true,
    wrap: true,
    grow: 1,
    cell: (row: LightSerieEntry) => (
      <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#666' }}>
        {row.ticker}
      </span>
    ),
  },
  {
    name: 'Grupo',
    cell: (row: LightSerieEntry) => <GroupBadge grupo={row.grupo} />,
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
    grow: 2,
  },
  {
    name: 'Fuente',
    selector: (row: LightSerieEntry) => row.fuente,
    sortable: true,
    grow: 1,
  },
  {
    name: 'Info',
    cell: (row: LightSerieEntry) => <ViewSerie serie={row} />,
    compact: true,
    maxWidth: '5rem',
  },
];

export default SerieListColumns;
