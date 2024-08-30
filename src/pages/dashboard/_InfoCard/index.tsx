import Panel from '@components/Panel';
import tokens from 'design-tokens/tokens.json';

const designSystem = tokens.xerenity;
const PURPLE_COLOR_200 = designSystem['purple-200'].value;

type InfoCardProps = {
  title: string;
  value: string | number;
};

const InfoCard = ({ title, value }: InfoCardProps) => (
  <Panel styles={{ display: 'flex', justifyContent: 'center' }}>
    <h4 className="text-center">{title}</h4>
    <h4 className="text-center" style={{ color: PURPLE_COLOR_200 }}>
      {value}
    </h4>
  </Panel>
);

export default InfoCard;
