export function niceStep(span: number, maxTicks: number): number {
  const rough = span / Math.max(1, maxTicks);
  const power = 10 ** Math.floor(Math.log10(Math.max(rough, 1)));
  for (const m of [1, 2, 5, 10]) {
    if (m * power >= rough) return m * power;
  }
  return 10 * power;
}

// Integer ticks only; iterating by index keeps huge bounds from stalling the loop.
export function ticks(lo: number, hi: number, maxTicks: number): number[] {
  const step = niceStep(hi - lo, maxTicks);
  const out: number[] = [];
  const first = Math.ceil(lo / step);
  const last = Math.floor(hi / step);
  for (let i = first; i <= last && out.length <= maxTicks + 1; i++) out.push(i * step);
  return out;
}
