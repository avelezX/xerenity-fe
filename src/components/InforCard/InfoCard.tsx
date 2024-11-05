import Panel from '@components/Panel';
import tokens from 'design-tokens/tokens.json';
import { DashboardBox } from 'src/models/charts/fetchDashboardBoxes';

const designSystem = tokens.xerenity;
const PURPLE_COLOR_200 = designSystem['purple-200'].value;

type InfoCardProps = {
  cardData: DashboardBox[];
  cardId: string;
};

type GenericCardProps = {
  name: string;
  value: string | number | undefined | null;
};

export const GenericCard = ({ name, value }: GenericCardProps) => (
  <Panel styles={{ display: 'flex', justifyContent: 'center' }}>
    <h4 className="text-center">{name || ''}</h4>
    <h4 className="text-center" style={{ color: PURPLE_COLOR_200 }}>
      {value || 0}
    </h4>
  </Panel>
);

const InfoCard = ({ cardData, cardId }: InfoCardProps) => {
  const boxInfo = cardData?.find((card) => card.box_name === cardId);
  return (
    boxInfo && (
      <GenericCard
        name={boxInfo.name || ''}
        value={boxInfo?.data.value.toFixed(2)}
      />
    )
  );
};

type TableValueProps = {
  value: number | undefined;
  multi?: number;
};

export const TableValue = ({ value, multi = 1 }: TableValueProps) => (
  <td>{value ? (value * multi).toFixed(2) : 0}</td>
);

export default InfoCard;
