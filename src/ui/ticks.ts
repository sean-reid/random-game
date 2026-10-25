export function niceStep(span: number, maxTicks: number): number {
  const rough = span / Math.max(1, maxTicks);
  const power = 10 ** Math.floor(Math.log10(Math.max(rough, 1e-9)));
  for (const m of [1, 2, 5, 10]) {
    if (m * power >= rough) return m * power;
  }
  return 10 * power;
}

export function ticks(lo: number, hi: number, maxTicks: number): number[] {
  const step = niceStep(hi - lo, maxTicks);
  const out: number[] = [];
  for (let n = Math.ceil(lo / step) * step; n <= hi; n += step) out.push(n);
  return out;
}
