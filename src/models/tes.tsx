export interface Tes {
  name: string;
}

export interface TesRaw {
  yield: number;
  volume: number;
  price: number;
  date: string;
}

export interface TesYields {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  day: string;
}


export interface CandleSerie {
  name: string;
  values: TesYields[];
}

export interface GridEntry {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tes: string;
  prev: number;
  displayname: string;
  operation_time: string;
  tes_months: number;
}

export function GridEntryToArray(entry: GridEntry) {
  return [
    entry.open.toString(),
    entry.high.toString(),
    entry.low.toString(),
    entry.close.toString(),
    entry.volume.toString(),
    entry.displayname.toString(),
    entry.operation_time.toString(),
  ];
}

export function TesEntryToArray(entry: TesYields) {
  return [
    entry.open.toFixed(2).toString(),
    entry.high.toFixed(2).toString(),
    entry.low.toFixed(2).toString(),
    entry.close.toFixed(2).toString(),
    entry.volume.toString(),
    entry.day.toString(),
  ];
}
