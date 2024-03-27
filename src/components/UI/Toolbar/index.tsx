import React, { PropsWithChildren } from 'react';
import ToolbarContainer from './ToolbarContainer';

export default function ToolBar(props: PropsWithChildren) {
  const { children } = props;
  return (
    <ToolbarContainer>
      <div className="toolbar-items">{children}</div>
    </ToolbarContainer>
  );
}
