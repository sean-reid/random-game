import {
  recommend,
  type Board,
  type Mix,
  type Recommendation,
  type RolloutReply,
  type RolloutRequest,
} from "./engine";

export interface Drawn {
  rec: Recommendation;
  pending: boolean;
}

const CACHE_MAX = 32;

export function keyOf(board: Board, after: number, mix: Mix): string {
  const guesses = [...board.guesses].sort((a, b) => a - b);
  return JSON.stringify([board.lo, board.hi, after, guesses, mix.middle, mix.anywhere, mix.hugger]);
}

// Answers from the cache or the exact zero-player curve at once, and hands rollouts to
// a worker; a reply is kept only if it carries the sequence number of the latest request.
export class Recommender {
  private readonly cache = new Map<string, Recommendation>();
  private seq = 0;
  private pending: { seq: number; key: string } | null = null;

  constructor(
    private readonly post: (request: RolloutRequest) => void,
    private readonly onResult: () => void,
  ) {}

  get(board: Board, after: number, mix: Mix, prefer: number | null): Drawn {
    const key = keyOf(board, after, mix);
    const hit = this.cache.get(key);
    if (hit) {
      this.pending = null;
      return { rec: hit, pending: false };
    }
    const exact = this.exact(board, mix);
    if (after === 0 || exact.best === null) {
      this.pending = null;
      this.remember(key, exact);
      return { rec: exact, pending: false };
    }
    if (this.pending?.key !== key) {
      this.pending = { seq: ++this.seq, key };
      this.post({ seq: this.seq, board, after, mix, prefer });
    }
    return { rec: exact, pending: true };
  }

  receive(reply: RolloutReply): void {
    if (this.pending === null || reply.seq !== this.pending.seq) return;
    this.remember(this.pending.key, reply.result);
    this.pending = null;
    this.onResult();
  }

  private exact(board: Board, mix: Mix): Recommendation {
    const key = keyOf(board, 0, mix);
    let rec = this.cache.get(key);
    if (!rec) {
      rec = recommend(board, 0, mix);
      this.remember(key, rec);
    }
    return rec;
  }

  private remember(key: string, rec: Recommendation): void {
    this.cache.set(key, rec);
    if (this.cache.size > CACHE_MAX) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
  }
}
