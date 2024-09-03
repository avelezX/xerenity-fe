import Panel from '@components/Panel';
import tokens from 'design-tokens/tokens.json';
import { DashboardBox } from 'src/models/charts/fetchDashboardBoxes';

const designSystem = tokens.xerenity;
const PURPLE_COLOR_200 = designSystem['purple-200'].value;

type InfoCardProps = {
  cardData: DashboardBox[];
  cardId: string;
};

const InfoCard = ({ cardData, cardId }: InfoCardProps) => {
  const boxInfo = cardData?.find((card) => card.box_name === cardId);
  return (
    boxInfo && (
      <Panel styles={{ display: 'flex', justifyContent: 'center' }}>
        <h4 className="text-center">{boxInfo.name || ''}</h4>
        <h4 className="text-center" style={{ color: PURPLE_COLOR_200 }}>
          {boxInfo?.data.value.toFixed(2) || ''}
        </h4>
      </Panel>
    )
  );
};

export default InfoCard;
