import React, { PropsWithChildren } from 'react';
import { AreaChart, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { LightSerieValue } from 'src/types/lightserie';

type SimpleLineProps = {
  data: LightSerieValue[];
} & PropsWithChildren;

export default function SimpleAreaChart({ data, children }: SimpleLineProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <Tooltip />
        <Legend />
        {children}
      </AreaChart>
    </ResponsiveContainer>
  );
}
