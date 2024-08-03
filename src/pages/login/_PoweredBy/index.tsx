import { Image } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faBolt } from '@fortawesome/free-solid-svg-icons';
import tokens from 'design-tokens/tokens.json';
import PoweredByContainer from './PoweredByContainer.styled';

const PRIMARY_COLOR = tokens.xerenity['purple-200'].value;

type Provider = {
  alt: string;
  url: string;
  width: number;
};

const PROVIDERS: Provider[] = [
  {
    alt: 'Dtcc',
    url: 'dtcc.svg',
    width: 84,
  },
  {
    alt: 'Govierno de Colombia',
    url: 'govco.svg',
    width: 120,
  },
  {
    alt: 'Banco de la republica',
    url: 'banrep.svg',
    width: 48,
  },
  {
    alt: 'Dane',
    url: 'dane.svg',
    width: 81,
  },
  {
    alt: 'Nasdaq',
    url: 'nasdaq.svg',
    width: 107,
  },
  {
    alt: 'Banco Central Europeo',
    url: 'eubank.svg',
    width: 48,
  },
];

const POWERED_BY = 'Powered By:';
const PATH = '/assets/img/providers/';

const PoweredBy = () => (
  <PoweredByContainer>
    <div className="powered-title">
      <Icon style={{ color: PRIMARY_COLOR }} icon={faBolt} />
      <span style={{ textAlign: 'center', color: PRIMARY_COLOR }}>
        {POWERED_BY}
      </span>
    </div>
    <div className="powered-brands">
      {PROVIDERS.map(({ alt, url, width }) => (
        <Image
          width={width}
          draggable="false"
          key={alt}
          alt={alt}
          src={`${PATH}/${url}`}
        />
      ))}
    </div>
  </PoweredByContainer>
);

export default PoweredBy;
