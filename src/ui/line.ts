import { regionOf, winAt, winEach, type Board, type Range, type Recommendation } from "../engine";
import { ticks } from "./ticks";

const CHAR = 7.2;
const MARGIN = 28;
const HEAD = 36;
const CURVE_H = 70;
const CURVE_BASE = HEAD + CURVE_H;
const LINE = CURVE_BASE + 24;
const THEM = LINE + 30;
const YOU = THEM + 34;
export const HEIGHT = YOU + 28;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const fmt = (n: number) => n.toFixed(1);
const pct = (p: number) => `${Math.round(p * 100)}%`;

function bracket(x1: number, x2: number, y: number, cls: string, label: string): string {
  const width = x2 - x1;
  let text = label;
  if (width < label.length * CHAR + 8) text = label.replace(/^.*?(\S+%)\S*$/, "$1");
  if (width < text.length * CHAR + 4) text = "";
  return `<path class="${cls}" d="M${fmt(x1)},${y - 5}v5H${fmt(x2)}v-5" fill="none"/>${
    text
      ? `<text class="${cls} lbl" x="${fmt((x1 + x2) / 2)}" y="${y + 16}" text-anchor="middle">${esc(text)}</text>`
      : ""
  }`;
}

export function renderLine(
  board: Board,
  rec: Recommendation,
  width: number,
  labels: ReadonlyMap<number, string> = new Map(),
  secret: number | null = null,
): string {
  const W = Math.max(280, width);
  const { lo, hi } = board;
  const x = (n: number) => MARGIN + ((n - lo) / Math.max(1, hi - lo)) * (W - 2 * MARGIN);
  const sorted = [...board.guesses].sort((a, b) => a - b);
  const placed = rec.best === null ? sorted : [...sorted, rec.best].sort((a, b) => a - b);
  const shares = winEach(placed, board);
  const pmax = Math.max(0, ...rec.curve.map((c) => c.p)) || 1;
  const parts: string[] = [];

  if (rec.curve.length > 1) {
    const first = rec.curve[0] as { x: number };
    const last = rec.curve[rec.curve.length - 1] as { x: number };
    const area = (pts: string[], cls: string) =>
      `<path class="${cls}" d="M${fmt(x(first.x))},${CURVE_BASE}L${pts.join("L")}L${fmt(x(last.x))},${CURVE_BASE}Z"/>`;
    const pts = rec.curve.map((c) => `${fmt(x(c.x))},${fmt(CURVE_BASE - (c.p / pmax) * CURVE_H)}`);
    parts.push(area(pts, "area"));
    if (rec.curve.some((c) => c.low < c.p)) {
      const lows = rec.curve.map(
        (c) => `${fmt(x(c.x))},${fmt(CURVE_BASE - (c.low / pmax) * CURVE_H)}`,
      );
      parts.push(area(lows, "area-low"));
    }
    parts.push(`<polyline class="curve" points="${pts.join(" ")}"/>`);
  }

  parts.push(
    `<line class="axis" x1="${MARGIN}" x2="${fmt(W - MARGIN)}" y1="${LINE}" y2="${LINE}"/>`,
  );
  for (const n of ticks(lo, hi, Math.floor(W / 80))) {
    if ([lo, hi].some((e) => Math.abs(x(e) - x(n)) < 24)) continue;
    if (sorted.some((g) => Math.abs(x(g) - x(n)) < 14)) continue;
    parts.push(
      `<line class="tick" x1="${fmt(x(n))}" x2="${fmt(x(n))}" y1="${LINE}" y2="${LINE + 5}"/>`,
      `<text class="tick-lbl" x="${fmt(x(n))}" y="${LINE + 18}" text-anchor="middle">${n}</text>`,
    );
  }
  parts.push(
    `<text class="tick-lbl" x="${fmt(x(lo))}" y="${LINE + 18}" text-anchor="middle">${lo}</text>`,
    `<text class="tick-lbl" x="${fmt(x(hi))}" y="${LINE + 18}" text-anchor="middle">${hi}</text>`,
  );

  for (const g of sorted) {
    parts.push(
      `<line class="guess" x1="${fmt(x(g))}" x2="${fmt(x(g))}" y1="${LINE - 10}" y2="${LINE + 10}"/>`,
    );
    const r = regionOf(
      g,
      placed.filter((o) => o !== g),
      board,
    );
    if (r && r.end >= r.start) {
      parts.push(
        bracket(
          x(r.start),
          x(r.end),
          THEM,
          "them",
          `${labels.get(g) ?? g} owns ${pct(shares.get(g) ?? 0)}`,
        ),
      );
    }
  }

  if (rec.best !== null) {
    const top = CURVE_BASE - (rec.bestWin / pmax) * CURVE_H;
    const bx = fmt(x(rec.best));
    parts.push(
      `<line class="you" x1="${bx}" x2="${bx}" y1="${fmt(top)}" y2="${LINE}"/>`,
      `<text class="you big" x="${bx}" y="${fmt(top - 10)}" text-anchor="middle">${rec.best}</text>`,
      `<circle class="you dot" cx="${bx}" cy="${LINE}" r="5"/>`,
    );
    const mine = regionOf(rec.best, sorted, board);
    if (mine && mine.end >= mine.start) {
      const now = winAt(rec.best, sorted, board);
      parts.push(bracket(x(mine.start), x(mine.end), YOU, "you", `you own ${pct(now)} now`));
    }
  }

  if (secret !== null && secret >= lo && secret <= hi) {
    const sx = fmt(x(secret));
    parts.push(
      `<line class="secret" x1="${sx}" x2="${sx}" y1="${HEAD}" y2="${LINE}"/>`,
      `<text class="secret-lbl" x="${sx}" y="${HEAD - 8}" text-anchor="middle">${secret}</text>`,
    );
  }

  const label =
    rec.best === null
      ? `Number line from ${lo} to ${hi}; every number is taken`
      : `Number line from ${lo} to ${hi} with ${sorted.length} guesses; recommended guess ${rec.best} with a ${pct(rec.bestWin)} chance`;
  return `<svg class="line-svg" width="${W}" height="${HEIGHT}" viewBox="0 0 ${W} ${HEIGHT}" role="img" aria-label="${esc(label)}">${parts.join("")}</svg>`;
}

export function numberAt(board: Range, width: number, px: number): number {
  const W = Math.max(280, width);
  const t = (px - MARGIN) / (W - 2 * MARGIN);
  return Math.round(board.lo + Math.min(1, Math.max(0, t)) * (board.hi - board.lo));
}
