// Pure metric helpers (no DOM) so they can be unit-tested with node:test.
export const GM = 0.8; // assumed gross margin

const KEYS = ['mrr', 'logos', 'new', 'newMrr', 'exp', 'con', 'churnMrr', 'churned'];

export function combine(data, plans) {
  const n = data.meta.months.length;
  const out = Object.fromEntries(KEYS.map((k) => [k, new Array(n).fill(0)]));
  for (const p of plans) for (const k of KEYS) data.series[p][k].forEach((v, i) => (out[k][i] += v));
  return out;
}

const div = (a, b) => (b ? a / b : 0);

export function monthly(s, t) {
  const startMrr = s.mrr[t - 1] ?? 0, startLogos = s.logos[t - 1] ?? 0;
  return {
    logoChurn: div(s.churned[t], startLogos),
    grossChurn: div(s.con[t] + s.churnMrr[t], startMrr),
    nrr: startMrr ? (startMrr + s.exp[t] - s.con[t] - s.churnMrr[t]) / startMrr : 1,
    netNew: s.newMrr[t] + s.exp[t] - s.con[t] - s.churnMrr[t],
    arpa: div(s.mrr[t], s.logos[t]),
  };
}

const avg = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);

// cost3 = acquisition spend over the last 3 months for the selected plans
export function kpis(s, cost3, t) {
  const win = (f, w) => avg([...Array(w).keys()].map((i) => monthly(s, t - i)[f]));
  const logoChurn = win('logoChurn', 3);
  const arpa = monthly(s, t).arpa;
  const ltv = logoChurn ? (arpa * GM) / logoChurn : 0;
  const newLogos = [0, 1, 2].reduce((a, i) => a + s.new[t - i], 0);
  const blendedCac = div(cost3, newLogos);
  let nrr12 = 1;
  for (let i = 0; i < 12; i++) nrr12 *= monthly(s, t - i).nrr;
  return {
    mrr: s.mrr[t], mrrPrev: s.mrr[t - 1], arr: s.mrr[t] * 12, logos: s.logos[t],
    netNew: monthly(s, t).netNew, netNewPrev: monthly(s, t - 1).netNew,
    logoChurn, logoChurnPrev: avg([1, 2, 3].map((i) => monthly(s, t - i).logoChurn)),
    grossChurn: win('grossChurn', 3), nrr12, arpa, ltv, cac: blendedCac,
    ltvCac: div(ltv, blendedCac), payback: div(blendedCac, arpa * GM),
  };
}

// Retention matrix: rows = cohorts (start index), cols = age. metric 0 = logos, 1 = revenue.
export function cohortMatrix(data, plans, metric, rows, maxAge) {
  const n = data.meta.months.length;
  const out = [];
  for (let c = n - rows; c < n; c++) {
    const base = plans.reduce((a, p) => a + data.cohorts[p][c][0][metric], 0);
    const cells = [];
    for (let a = 0; a <= Math.min(maxAge, n - 1 - c); a++) {
      cells.push(base ? plans.reduce((x, p) => x + data.cohorts[p][c][a][metric], 0) / base : null);
    }
    out.push({ month: data.meta.months[c], size: plans.reduce((a, p) => a + data.cohorts[p][c][0][0], 0), cells });
  }
  return out;
}
