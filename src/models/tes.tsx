export interface Tes {
    name:string;
  }

  export interface TesRaw {
    yield: number;
    volume: number;
    price: number;
    date:string;
  }

  export interface TesYields {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    day:string;
  }


export interface CandleSerie{
    name:string;
    values:TesYields[];
}


export interface GridEntry{
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tes:string;
  prev: number;
  displayname:string;
  operation_time:string;  
}
