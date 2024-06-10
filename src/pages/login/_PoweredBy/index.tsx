import { Image } from 'react-bootstrap';
import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faB, faBolt } from '@fortawesome/free-solid-svg-icons';
import tokens from 'design-tokens/tokens.json';

const PRIMARY_COLOR = tokens.xerenity['purple-200'].value;

type Provider = {
  alt: string;
  url: string;
};

const PROVIDERS: Provider[] = [
  {
    alt: 'Dtcc',
    url: 'dtcc.svg',
  },
  {
    alt: 'Govierno de Colombia',
    url: 'govco.svg',
  },
  {
    alt: 'Banco de la republica',
    url: 'banrep.svg',
  },
  {
    alt: 'Dane',
    url: 'dane.svg',
  },
  {
    alt: 'Nasdaq',
    url: 'nasdaq.svg',
  },
  {
    alt: 'Banco Central Europeo',
    url: 'eubank.svg',
  },
];

const POWERED_BY = 'Powered By:';
const PATH = '/assets/img/providers/';

const PoweredBy = () => (
  <div className="d-flex flex-column justify-content-center gap-5">
    <div className="d-flex justify-content-center align-items-center gap-2">
      <Icon style={{ color: PRIMARY_COLOR }} icon={faBolt} />
      <span style={{ textAlign: 'center', color: PRIMARY_COLOR }}>
        {POWERED_BY}
      </span>
    </div>
    <div className="d-flex justify-content-between">
      {PROVIDERS.map(({ alt, url }) => (
        <Image draggable="false" key={alt} alt={alt} src={`${PATH}/${url}`} />
      ))}
    </div>
  </div>
);

export default PoweredBy;
