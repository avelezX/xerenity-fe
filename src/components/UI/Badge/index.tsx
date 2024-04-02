import { Badge as BsBadge, BadgeProps as BsBadgeProps } from 'react-bootstrap';
import { FC } from 'react';

import styled from 'styled-components';

interface BadgeProps extends BsBadgeProps {
  $fullwidth?: boolean;
}

const Badge: FC<BadgeProps> = styled(BsBadge)`
  background-color: ${(props) => props.bg};
`;

export default Badge;
