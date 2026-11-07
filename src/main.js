import './style.css';
import { combine, kpis, monthly, cohortMatrix, GM } from './metrics.js';
import { usd, pct, stacked, movements, lines, hbars, heat } from './charts.js';

const COLORS = { Starter: '#b8691a', Team: '#1f6f54', Business: '#1d3a4f' };
const state = { plan: 'All', range: 24, cmetric: 0 };
let data;

const $ = (id) => document.getElementById(id);
const plansSel = () => (state.plan === 'All' ? Object.keys(data.meta.plans) : [state.plan]);

function seg(el, opts, key) {
  el.innerHTML = opts.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${state[key] == v}">${l}</button>`).join('');
  el.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state[key] = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v;
    render();
  };
}

function delta(cur, prev, fmt, invert = false, label = 'vs prior month') {
  if (!prev) return '';
  const d = (cur - prev) / Math.abs(prev); const good = invert ? d < 0 : d > 0;
  return `<div class="d ${good ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d * 100).toFixed(1)}% <i>${label}</i></div>`;
}

function render() {
  const months = data.meta.months; const n = months.length; const t = n - 1;
  const plans = plansSel(); const all = Object.keys(data.meta.plans);
  seg($('plans'), [['All', 'All plans'], ...all.map((p) => [p, p])], 'plan');
  seg($('range'), [[12, '12 mo'], [24, '24 mo'], [36, '36 mo']], 'range');
  seg($('cmetric'), [[0, 'Logos'], [1, 'Revenue']], 'cmetric');

  const s = combine(data, plans); const from = Math.max(1, n - state.range);
  const cost3 = plans.reduce((a, p) => a + data.meta.cac[p] * [0, 1, 2].reduce((x, i) => x + data.series[p].new[t - i], 0), 0);
  const k = kpis(s, cost3, t);
  const card = (l, v, d) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div>${d}</div>`;
  $('kpis').innerHTML = [
    card('MRR', usd(k.mrr), delta(k.mrr, k.mrrPrev, usd)),
    card('ARR run-rate', usd(k.arr), `<div class="d"><i>${k.logos.toLocaleString('en-US')} paying accounts</i></div>`),
    card('Net new MRR', usd(k.netNew), delta(k.netNew, k.netNewPrev, usd)),
    card('NRR · 12 mo', pct(k.nrr12, 0), `<div class="d ${k.nrr12 >= 1 ? 'up' : 'down'}">${k.nrr12 >= 1 ? 'Expansion outweighs churn' : 'Net contraction'}</div>`),
    card('Logo churn · 3 mo avg', pct(k.logoChurn, 2), delta(k.logoChurn, k.logoChurnPrev, pct, true, 'vs prior 3 mo')),
    card('ARPA', usd(k.arpa), `<div class="d"><i>per account / month</i></div>`),
    card('LTV', usd(k.ltv), `<div class="d"><i>${GM * 100}% gross margin</i></div>`),
    card('LTV : CAC', k.ltvCac.toFixed(1) + '×', `<div class="d ${k.ltvCac >= 3 ? 'up' : 'down'}">Payback ${k.payback.toFixed(1)} mo</div>`),
  ].join('');

  const w = (id) => Math.max(260, Math.floor($(id).clientWidth));
  const sl = (a) => a.slice(from);
  const mm = months.slice(from);
  stacked($('c-mrr'), mm, plans.map((p) => ({ n: p, c: COLORS[p], v: sl(data.series[p].mrr) })), w('c-mrr'));
  movements($('c-move'), mm, [
    { n: 'New', c: '#1f6f54', v: sl(s.newMrr) }, { n: 'Expansion', c: '#7fb59b', v: sl(s.exp) },
    { n: 'Contraction', c: '#e0b36a', v: sl(s.con) }, { n: 'Churn', c: '#b3392f', v: sl(s.churnMrr) },
  ], w('c-move'));
  const ms = months.map((_, i) => (i ? monthly(s, i) : { logoChurn: 0, grossChurn: 0 }));
  lines($('c-churn'), mm, [
    { n: 'Logo churn', c: '#b3392f', v: sl(ms.map((m) => m.logoChurn)) },
    { n: 'Gross revenue churn', c: '#1d3a4f', v: sl(ms.map((m) => m.grossChurn)) },
  ], w('c-churn'));
  hbars($('c-ltv'), all.map((p) => {
    const kp = kpis(data.series[p], data.meta.cac[p] * [0, 1, 2].reduce((x, i) => x + data.series[p].new[t - i], 0), t);
    return { n: p, v: kp.ltvCac, c: COLORS[p], on: plans.includes(p) };
  }), w('c-ltv'));
  heat($('c-cohort'), cohortMatrix(data, plans, state.cmetric, w('c-cohort') < 520 ? 12 : 18, w('c-cohort') < 520 ? 12 : 18), w('c-cohort'), state.cmetric ? 'revenue still paying' : 'logos still active');

  const row = (p) => {
    const sp = data.series[p]; const kp = kpis(sp, data.meta.cac[p] * [0, 1, 2].reduce((x, i) => x + sp.new[t - i], 0), t);
    return `<tr><td><span class="dot" style="background:${COLORS[p]}"></span>${p}</td><td>${usd(sp.mrr[t])}</td><td>${sp.logos[t]}</td><td>${usd(kp.arpa)}</td><td>${pct(kp.logoChurn, 2)}</td><td>${usd(kp.ltv)}</td><td>${usd(data.meta.cac[p])}</td><td>${kp.ltvCac.toFixed(1)}×</td></tr>`;
  };
  const kt = kpis(combine(data, all), all.reduce((a, p) => a + data.meta.cac[p] * [0, 1, 2].reduce((x, i) => x + data.series[p].new[t - i], 0), 0), t);
  $('tbl').innerHTML = `<table><thead><tr><th>Plan</th><th>MRR</th><th>Accounts</th><th>ARPA</th><th>Logo churn</th><th>LTV</th><th>CAC</th><th>LTV:CAC</th></tr></thead><tbody>${all.map(row).join('')}<tr><td>All plans</td><td>${usd(kt.mrr)}</td><td>${kt.logos}</td><td>${usd(kt.arpa)}</td><td>${pct(kt.logoChurn, 2)}</td><td>${usd(kt.ltv)}</td><td>${usd(kt.cac)}</td><td>${kt.ltvCac.toFixed(1)}×</td></tr></tbody></table>`;
}

fetch(import.meta.env.BASE_URL + 'data.json').then((r) => r.json()).then((d) => {
  data = d; render();
  let lastW = innerWidth; let tm;
  addEventListener('resize', () => { clearTimeout(tm); tm = setTimeout(() => { if (innerWidth !== lastW) { lastW = innerWidth; render(); } }, 120); });
});
