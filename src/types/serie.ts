export interface SerieValue {
  time: string;
  value: number;
}

export interface Serie {
  name: string;
  values: SerieValue[];
}
