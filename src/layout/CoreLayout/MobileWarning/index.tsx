import { FontAwesomeIcon as Icon } from '@fortawesome/react-fontawesome';
import { faScrewdriverWrench } from '@fortawesome/free-solid-svg-icons';
import Button from '@components/UI/Button';
import styled from 'styled-components';
import tokens from 'design-tokens/tokens.json';

const designSystem = tokens.xerenity;
const PURPLE_300 = designSystem['purple-300'].value;

const FIRST_LINE =
  'Estamos trabajando para brindarte la mejor experiencia desde tu dispositivo movil!';

const SECOND_LINE =
  'En el momento puedes interactuar con la App desde un computador.';

const BUTTON_TXT = 'Salir De Xerenity';

type MobileWarningProps = {
  onLogout: () => void;
};

const WarningContainer = styled.div`
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  gap: 36px;

  .warning-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18px;
  }

  p {
    font-size: 18px;
    text-align: center;
  }

  svg,
  rect,
  path {
    fill: ${PURPLE_300};
  }
`;

const MobileWarning = ({ onLogout }: MobileWarningProps) => (
  <WarningContainer>
    <div className="warning-content">
      <Icon icon={faScrewdriverWrench} size="6x" />
      <p>{FIRST_LINE}</p>
      <p>{SECOND_LINE}</p>
    </div>
    <Button onClick={onLogout}>{BUTTON_TXT}</Button>
  </WarningContainer>
);

export default MobileWarning;
