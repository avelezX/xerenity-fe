import { LightSerieValue } from 'src/types/lightserie';

type NormalizeDateProps = {
  existingSeries: LightSerieValue[];
  fromNormalizeDate?: string;
};

export default function normalizeSeries({
  existingSeries,
  fromNormalizeDate,
}: NormalizeDateProps): LightSerieValue[] {
  const nSerie = new Array<LightSerieValue>();

  if (existingSeries.length > 0) {
    let divisor: number = existingSeries[0].value;

    if (fromNormalizeDate) {
      existingSeries.forEach((dte) => {
        if (dte.time === fromNormalizeDate) {
          divisor = dte.value;
        }
      });

      existingSeries.forEach((entry) => {
        if (entry.time >= fromNormalizeDate) {
          nSerie.push({
            value: entry.value / divisor,
            time: entry.time,
          });
        }
      });
    } else {
      existingSeries.forEach((entry) => {
        nSerie.push({
          value: entry.value / divisor,
          time: entry.time,
        });
      });
    }
  }

  return nSerie;
}
