import Panel from '@components/Panel';
import tokens from 'design-tokens/tokens.json';
import { DashboardBox } from 'src/models/charts/fetchDashboardBoxes';

const designSystem = tokens.xerenity;
const PURPLE_COLOR_200 = designSystem['purple-200'].value;

type InfoCardProps = {
  boxData: DashboardBox[];
  id: string;
};

const InfoCard = ({ boxData, id }: InfoCardProps) => (
  <Panel styles={{ display: 'flex', justifyContent: 'center' }}>
    <h4 className="text-center">
      {boxData.find((box) => box.box_name === id)?.name}
    </h4>
    <h4 className="text-center" style={{ color: PURPLE_COLOR_200 }}>
      {boxData.find((box) => box.box_name === id)?.data.value.toFixed(2) || ''}
    </h4>
  </Panel>
);

export default InfoCard;
