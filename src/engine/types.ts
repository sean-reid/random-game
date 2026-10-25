export interface Range {
  lo: number;
  hi: number;
}

export interface Board extends Range {
  guesses: number[];
}

export interface CurvePoint {
  x: number;
  p: number;
}

export interface Recommendation {
  best: number | null;
  bestWin: number;
  curve: CurvePoint[];
}
