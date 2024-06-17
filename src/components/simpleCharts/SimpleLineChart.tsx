import React, { PropsWithChildren } from 'react';
import { LineChart, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { LightSerieValue } from 'src/types/lightserie';

type SimpleLineProps = {
  data: LightSerieValue[];
} & PropsWithChildren;

export default function SimpleLineChart({ data, children }: SimpleLineProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <Tooltip />
        <Legend />
        {children}
      </LineChart>
    </ResponsiveContainer>
  );
}
