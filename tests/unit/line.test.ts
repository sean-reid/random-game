import { describe, expect, it } from "vitest";
import { recommend } from "../../src/engine";
import { numberAt, renderLine, shortName } from "../../src/ui/line";

const board = { lo: 1, hi: 100, guesses: [30, 80] };
const rec = recommend(board, 1);

describe("renderLine", () => {
  it("marks the recommended guess and what everyone owns once it is placed", () => {
    const svg = renderLine(board, rec, 960);
    expect(svg).toContain(">25<");
    expect(svg).toContain("30 owns 28%");
    expect(svg).toContain("80 owns 46%");
    expect(svg).toContain("you own 27% now");
    expect(svg).toContain('class="area-low"');
    expect(svg).toContain(
      'aria-label="Number line from 1 to 100 with 2 guesses; recommended guess 25',
    );
  });

  it("draws no bad-round band when nobody guesses after you", () => {
    const svg = renderLine(board, recommend(board, 0), 960);
    expect(svg).not.toContain('class="area-low"');
  });

  it("labels a stretch by name when given one, escaping markup", () => {
    const svg = renderLine(board, rec, 960, new Map([[30, 'A<b>"na']]));
    expect(svg).toContain("A&lt;b&gt;&quot;na owns 28%");
    expect(svg).not.toContain("<b>");
  });

  it("uses round-number ticks, keeps the ends, and steps off guesses", () => {
    const svg = renderLine(board, rec, 960);
    expect(svg).toContain(">50<");
    expect(svg).toContain(">1<");
    expect(svg).toContain(">100<");
    expect(svg).not.toContain(">30<");
    expect(svg).not.toContain(">80<");
  });

  it("keeps a short name on the bracket before falling back to the percentage", () => {
    const tight = { lo: 1, hi: 100, guesses: [30, 31, 32] };
    const svg = renderLine(tight, recommend(tight, 0), 960);
    expect(svg).toContain("30 owns 30%");
    expect(svg).not.toContain("31 owns");
    const names = new Map([
      [30, "Annabel"],
      [80, "Ben"],
    ]);
    const narrow = renderLine(board, rec, 320);
    expect(narrow).toContain(">30 28%<");
    expect(narrow).toMatch(/class="you lbl"[^>]*>27%</);
    const named = renderLine(board, rec, 320, names);
    expect(named).toContain(">Ann. 28%<");
    expect(named).toContain(">Ben owns 46%<");
    const tiny = renderLine(board, rec, 200, names);
    expect(tiny).toContain(">28%<");
    expect(shortName("Ann")).toBe("Ann");
    expect(shortName("Annabel")).toBe("Ann.");
  });

  it("shows the revealed number instead of the recommendation", () => {
    const svg = renderLine(board, rec, 960, new Map(), 33);
    expect(svg).toContain('class="secret-lbl"');
    expect(svg).not.toContain('class="you big"');
    expect(svg).not.toContain("you own");
    expect(svg).toContain("the number was 33");
    expect(renderLine(board, rec, 960, new Map(), 500)).not.toContain('class="secret"');
  });

  it("says when the range is full and drops the empty curve space", () => {
    const full = { lo: 1, hi: 2, guesses: [1, 2] };
    const svg = renderLine(full, recommend(full, 0), 400);
    expect(svg).toContain("every number is taken");
    expect(svg).not.toContain("you own");
    expect(svg).toMatch(/viewBox="0 70 /);
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
