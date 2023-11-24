import React, { PropsWithChildren } from 'react';
import { BarChart,Tooltip, Legend, ResponsiveContainer } from 'recharts';

type SimpleLineProps = {
    data:any[];
} & PropsWithChildren

export default function SimpleBarChart({data,children}:SimpleLineProps){
    return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
                <Tooltip />
                <Legend />
                    {children}
            </BarChart>
      </ResponsiveContainer>
    )
}