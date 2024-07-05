import { LightSerieValue } from 'src/types/lightserie';

const InflationColumns = [
  {
    name: 'Fecha',
    selector: (row: LightSerieValue) => row.time,
    sortable: true,
  },
  {
    name: 'Cambio % IPC meses',
    selector: (row: LightSerieValue) => row.value.toFixed(2),
    sortable: true,
  },
];

export default InflationColumns;
