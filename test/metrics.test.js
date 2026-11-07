import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { combine, monthly, kpis, cohortMatrix } from '../src/metrics.js';

const data = JSON.parse(readFileSync(new URL('../public/data.json', import.meta.url)));
const plans = Object.keys(data.meta.plans);

test('combined MRR equals sum of plans', () => {
  const s = combine(data, plans);
  const t = s.mrr.length - 1;
  assert.equal(s.mrr[t], plans.reduce((a, p) => a + data.series[p].mrr[t], 0));
});

test('NRR of a month reconciles with the waterfall', () => {
  const s = combine(data, plans);
  const t = 20;
  const m = monthly(s, t);
  assert.ok(Math.abs(m.nrr * s.mrr[t - 1] - (s.mrr[t] - s.newMrr[t])) < 1e-6);
});

test('KPIs are finite and LTV:CAC positive', () => {
  const s = combine(data, plans);
  const k = kpis(s, 100000, s.mrr.length - 1);
  for (const v of Object.values(k)) assert.ok(Number.isFinite(v));
  assert.ok(k.ltvCac > 0);
});

test('cohort month 0 retention is 100%', () => {
  const rows = cohortMatrix(data, plans, 0, 12, 12);
  for (const r of rows) assert.equal(r.cells[0], 1);
});
