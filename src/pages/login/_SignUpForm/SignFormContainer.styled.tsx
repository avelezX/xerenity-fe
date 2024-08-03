import styled, { css } from 'styled-components';
import { tablet } from 'src/utils/mediaQueries';
import { Form } from 'react-bootstrap';

const SignFormContainer = styled(Form)`
  display: flex;
  width: 50%;
  justify-content: center;
  flex-direction: column;
  gap: 28px;

  .form-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }
  ${tablet(css`
    width: 100%;
  `)}
`;

export default SignFormContainer;
