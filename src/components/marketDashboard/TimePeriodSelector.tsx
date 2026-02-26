import React from 'react';
import { TimePeriod, TIME_PERIODS } from 'src/types/watchlist';
import {
  PeriodButtonGroup,
  PeriodButton,
} from './styled/TimePeriodButton.styled';

type TimePeriodSelectorProps = {
  activePeriod: TimePeriod;
  onChange: (period: TimePeriod) => void;
};

export default function TimePeriodSelector({
  activePeriod,
  onChange,
}: TimePeriodSelectorProps) {
  return (
    <PeriodButtonGroup>
      {TIME_PERIODS.map((period) => (
        <PeriodButton
          key={period}
          active={activePeriod === period}
          onClick={() => onChange(period)}
        >
          {period}
        </PeriodButton>
      ))}
    </PeriodButtonGroup>
  );
}
