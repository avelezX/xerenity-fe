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
    let dateCompare: string = existingSeries[0].time;
    if (fromNormalizeDate) {
      dateCompare = fromNormalizeDate;
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
            dateCompare = next.time;
            break;
          }
        }
      }
    }

    existingSeries.forEach((entry) => {
      if (entry.time >= dateCompare) {
        nSerie.push({
          value: entry.value / divisor,
          time: entry.time,
        });
      }
    });
  }

  return nSerie;
}
