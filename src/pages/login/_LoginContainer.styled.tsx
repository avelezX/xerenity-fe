import styled from 'styled-components';
import { desktop, laptop } from 'src/utils/mediaQueries';

const LoginContainer = styled.div`
  display: flex;
  height: auto;

  .form-wrapper {
    background: white;
    height: 100%;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 15px;
    padding: 0 15px;
    flex: 2 1 60%;

    ${desktop(`
      justify-content: space-around;
    `)}

    .container {
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 10px;
      padding: 12px 0;
      .login-tabs {
        display: flex;
        justify-content: center;
      }
      .login-forms {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 15px 0;
      }
    }
  }

  .chart-wrapper {
    display: flex;
    flex: 1 2 40%;
    justify-content: center;
    align-items: center;
    padding: 0 15px;

    ${laptop(`
      display: none;
    `)};
  }
`;

export default LoginContainer;
