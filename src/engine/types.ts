import type { Mix } from "./opponents";

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
  low: number;
  se: number;
}

export interface Recommendation {
  best: number | null;
  bestWin: number;
  bestLow: number;
  curve: CurvePoint[];
}

export interface RolloutRequest {
  seq: number;
  board: Board;
  after: number;
  mix: Mix;
  prefer: number | null;
}

export interface RolloutReply {
  seq: number;
  result: Recommendation;
}
