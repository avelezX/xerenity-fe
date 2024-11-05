import Panel from '@components/Panel';
import tokens from 'design-tokens/tokens.json';
import { DashboardBox } from 'src/models/charts/fetchDashboardBoxes';
import currencyFormat from 'src/utils/currencyFormat';

const designSystem = tokens.xerenity;
const PURPLE_COLOR_200 = designSystem['purple-200'].value;

type InfoCardProps = {
  cardData: DashboardBox[];
  cardId: string;
};

type GenericCardProps = {
  name: string;
  value: number | undefined | null;
  multi?: number;
  text?: string;
  fixed?: number;
};

export const GenericCard = ({
  name,
  value,
  multi = 1,
  text,
  fixed = 2,
}: GenericCardProps) => (
  <Panel styles={{ display: 'flex', justifyContent: 'center' }}>
    <h4 className="text-center">{name || ''}</h4>
    <h4 className="text-center" style={{ color: PURPLE_COLOR_200 }}>
      {value ? `${(value * multi).toFixed(fixed)} ${text || ''}` : 0}
    </h4>
  </Panel>
);

const InfoCard = ({ cardData, cardId }: InfoCardProps) => {
  const boxInfo = cardData?.find((card) => card.box_name === cardId);
  return (
    boxInfo && (
      <GenericCard name={boxInfo.name || ''} value={boxInfo?.data.value} />
    )
  );
};

type TableValueProps = {
  value: number | undefined;
  multi?: number;
  title?: string;
};

export const TableValue = ({ title, value, multi = 1 }: TableValueProps) => (
  <td>
    {title}
    {value ? currencyFormat(value * multi) : 0}
  </td>
);

export default InfoCard;
