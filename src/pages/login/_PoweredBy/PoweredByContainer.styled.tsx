import styled from 'styled-components';
import { tablet } from 'src/utils/mediaQueries';

const PoweredByContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 30px;
  padding: 50px 0;

  .powered-title {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
  }

  .powered-brands {
    display: flex;
    justify-content: space-between;

    ${tablet(`
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 40px;
      padding: 15px 0;
    `)}
  }
`;

export default PoweredByContainer;
