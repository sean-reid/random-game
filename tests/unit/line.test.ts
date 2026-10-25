import { describe, expect, it } from "vitest";
import { recommend } from "../../src/engine";
import { numberAt, renderLine } from "../../src/ui/line";

const board = { lo: 1, hi: 100, guesses: [30, 80] };
const rec = recommend(board, 1);

describe("renderLine", () => {
  it("marks the recommended guess and what everyone owns once it is placed", () => {
    const svg = renderLine(board, rec, 960);
    expect(svg).toContain(">25<");
    expect(svg).toContain("30 owns 28%");
    expect(svg).toContain("80 owns 46%");
    expect(svg).toContain("you own 27%");
    expect(svg).toContain(
      'aria-label="Number line from 1 to 100 with 2 guesses; recommended guess 25',
    );
  });

  it("labels a stretch by name when given one", () => {
    const svg = renderLine(board, rec, 960, new Map([[30, "Ana"]]));
    expect(svg).toContain("Ana owns 28%");
    expect(svg).toContain("80 owns 46%");
  });

  it("marks the revealed number", () => {
    const svg = renderLine(board, rec, 960, new Map(), 33);
    expect(svg).toContain('class="secret"');
    expect(svg).toContain('class="secret-lbl"');
    expect(renderLine(board, rec, 960, new Map(), 500)).not.toContain('class="secret"');
  });

  it("uses round-number ticks and keeps the ends", () => {
    const svg = renderLine(board, rec, 960);
    expect(svg).toContain(">50<");
    expect(svg).toContain(">1<");
    expect(svg).toContain(">100<");
    expect(svg).not.toContain(">11<");
  });

  it("drops bracket text that would not fit", () => {
    const tight = { lo: 1, hi: 100, guesses: [30, 31, 32] };
    const svg = renderLine(tight, recommend(tight, 0), 960);
    expect(svg).toContain("30 owns 30%");
    expect(svg).not.toContain("31 owns");
    const narrow = renderLine(board, rec, 320);
    expect(narrow).toContain("46%");
  });

  it("says when the range is full", () => {
    const full = { lo: 1, hi: 2, guesses: [1, 2] };
    const svg = renderLine(full, recommend(full, 0), 400);
    expect(svg).toContain("every number is taken");
    expect(svg).not.toContain("you own");
  });
});

describe("numberAt", () => {
  it("maps a pixel back to the nearest number", () => {
    expect(numberAt(board, 960, 28)).toBe(1);
    expect(numberAt(board, 960, 932)).toBe(100);
    expect(numberAt(board, 960, 480)).toBe(51);
    expect(numberAt(board, 960, -50)).toBe(1);
  });
});
