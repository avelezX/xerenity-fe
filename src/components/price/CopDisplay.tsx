import React from 'react';

interface TagProps {
  value: number;
}
export default function PriceTagTd({ value }: TagProps) {
  return (
    <td>
      {value.toLocaleString('us-US', {
        style: 'currency',
        currency: 'COP',
        currencyDisplay: 'code',
        maximumFractionDigits: 0,
      })}
    </td>
  );
}
