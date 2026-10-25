import { describe, expect, it } from "vitest";
import { PRIOR_MIX, recommend, type RolloutReply, type RolloutRequest } from "../../src/engine";
import { keyOf, Recommender } from "../../src/recommender";

// Stands in for the worker: it queues requests and answers them with the real engine.
function harness() {
  const posted: RolloutRequest[] = [];
  let results = 0;
  const r = new Recommender(
    (req) => posted.push(req),
    () => results++,
  );
  const answer = (req: RolloutRequest): RolloutReply => ({
    seq: req.seq,
    result: recommend(req.board, req.after, req.mix, req.prefer),
  });
  return { r, posted, answer, results: () => results };
}

const board = { lo: 1, hi: 100, guesses: [30, 80] };

describe("Recommender", () => {
  it("answers zero later players at once without posting", () => {
    const { r, posted } = harness();
    const d = r.get(board, 0, PRIOR_MIX, null);
    expect(d.pending).toBe(false);
    expect(d.rec).toEqual(recommend(board, 0));
    expect(posted).toHaveLength(0);
  });

  it("draws the exact curve while a rollout is out, then the rollout once it lands", () => {
    const { r, posted, answer, results } = harness();
    const first = r.get(board, 1, PRIOR_MIX, null);
    expect(first.pending).toBe(true);
    expect(first.rec).toEqual(recommend(board, 0));
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ board, after: 1, prefer: null });

    r.receive(answer(posted[0] as RolloutRequest));
    expect(results()).toBe(1);
    const second = r.get(board, 1, PRIOR_MIX, null);
    expect(second.pending).toBe(false);
    expect(second.rec.best).toBe(25);
    expect(posted).toHaveLength(1);
  });

  it("drops a reply whose request was overtaken", () => {
    const { r, posted, answer, results } = harness();
    r.get(board, 1, PRIOR_MIX, null);
    const other = { lo: 1, hi: 100, guesses: [30] };
    r.get(other, 1, PRIOR_MIX, null);
    expect(posted).toHaveLength(2);
    r.receive(answer(posted[0] as RolloutRequest));
    expect(results()).toBe(0);
    expect(r.get(board, 1, PRIOR_MIX, null).pending).toBe(true);
    expect(posted).toHaveLength(3);
    r.receive(answer(posted[2] as RolloutRequest));
    expect(results()).toBe(1);
    expect(r.get(board, 1, PRIOR_MIX, null).pending).toBe(false);
  });

  it("does not post again for the same board while a request is out", () => {
    const { r, posted } = harness();
    r.get(board, 3, PRIOR_MIX, null);
    r.get(board, 3, PRIOR_MIX, null);
    expect(posted).toHaveLength(1);
  });

  it("passes the preferred spot through", () => {
    const { r, posted } = harness();
    r.get(board, 1, PRIOR_MIX, 24);
    expect(posted[0]?.prefer).toBe(24);
  });

  it("treats a full board as settled without a rollout", () => {
    const { r, posted } = harness();
    const d = r.get({ lo: 1, hi: 2, guesses: [1, 2] }, 5, PRIOR_MIX, null);
    expect(d.pending).toBe(false);
    expect(d.rec.best).toBeNull();
    expect(posted).toHaveLength(0);
  });

  it("keys on the sorted guesses and the mix", () => {
    expect(keyOf({ lo: 1, hi: 100, guesses: [80, 30] }, 1, PRIOR_MIX)).toBe(
      keyOf({ lo: 1, hi: 100, guesses: [30, 80] }, 1, PRIOR_MIX),
    );
    expect(keyOf(board, 1, PRIOR_MIX)).not.toBe(
      keyOf(board, 1, { middle: 1, anywhere: 0, hugger: 0 }),
    );
    expect(keyOf(board, 1, PRIOR_MIX)).not.toBe(keyOf(board, 2, PRIOR_MIX));
  });
});
