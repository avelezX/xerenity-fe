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
      for (let i = 0; i < existingSeries.length; i += 1) {
        const cur = existingSeries[i];
        const previous = existingSeries[i - 1];
        const next = existingSeries[i + 1];
        if (cur.time === fromNormalizeDate) {
          divisor = cur.value;
          break;
        } else if (previous && next) {
          if (previous < cur && next > cur) {
            divisor = next.value;
            break;
          }
        }
      }
    }
    existingSeries.forEach((entry) => {
      nSerie.push({
        value: (entry.value / divisor) * 100,
        time: entry.time,
      });
    });
  }

  return nSerie;
}
