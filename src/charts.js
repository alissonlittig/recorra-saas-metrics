// Hand-built SVG charts. Each draw function returns nothing and renders into `el` at its current width.
const tip = () => document.getElementById('tip');
const usd0 = (v) => (v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e4 ? `$${(v / 1e3).toFixed(1)}k` : `$${Math.round(v).toLocaleString('en-US')}`);
export const usd = (v) => (v < 0 ? '−' : '') + usd0(Math.abs(v));
export const pct = (v, d = 1) => `${(v * 100).toFixed(d)}%`;
const mLabel = (m) => new Date(m + '-01T12:00:00').toLocaleString('en-US', { month: 'short', year: '2-digit' });
export { mLabel };

function nice(max) {
  const p = 10 ** Math.floor(Math.log10(max || 1));
  const f = max / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

function frame(w, h, m) { return { w, h, m, iw: w - m.l - m.r, ih: h - m.t - m.b }; }

function axes(f, ticks, fmt, labels, step) {
  let s = '';
  for (const t of ticks) {
    s += `<line class="gl" x1="${f.m.l}" x2="${f.w - f.m.r}" y1="${t.y}" y2="${t.y}"/><text x="${f.m.l - 8}" y="${t.y + 4}" text-anchor="end">${fmt(t.v)}</text>`;
  }
  labels.forEach((l, i) => { if (i % step === 0) s += `<text x="${l.x}" y="${f.h - 6}" text-anchor="middle">${l.t}</text>`; });
  return s;
}

function hover(el, f, xs, html) {
  const svg = el.querySelector('svg'); const t = tip();
  const hide = () => (t.hidden = true);
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * f.w;
    let i = 0, best = 1e9;
    xs.forEach((v, k) => { const d = Math.abs(v - x); if (d < best) { best = d; i = k; } });
    t.innerHTML = html(i); t.hidden = false;
    const tw = t.offsetWidth; let left = e.clientX + 14; if (left + tw > innerWidth - 8) left = e.clientX - tw - 14;
    t.style.left = Math.max(8, left) + 'px'; t.style.top = Math.max(8, e.clientY - 20) + 'px';
  });
}

const tipRows = (title, rows) => `<b>${title}</b>${rows.map((r) => `<span><i style="color:${r.c}">●&nbsp;${r.n}</i><em style="font-style:normal">${r.v}</em></span>`).join('')}`;
export const legend = (items) => `<div class="legend">${items.map((i) => `<span><b style="background:${i.c}"></b>${i.n}</span>`).join('')}</div>`;

export function stacked(el, months, layers, w) {
  const h = w < 520 ? 230 : 300; const f = frame(w, h, { l: 46, r: 8, t: 10, b: 26 });
  const n = months.length; const tot = months.map((_, i) => layers.reduce((a, l) => a + l.v[i], 0));
  const top = nice(Math.max(...tot)); const X = (i) => f.m.l + (f.iw * i) / (n - 1); const Y = (v) => f.m.t + f.ih - (v / top) * f.ih;
  const base = new Array(n).fill(0); let paths = '';
  for (const l of layers) {
    const up = l.v.map((v, i) => [X(i), Y(base[i] + v)]); const dn = l.v.map((v, i) => [X(i), Y(base[i])]).reverse();
    paths += `<path d="M${up.map((p) => p.join(',')).join('L')}L${dn.map((p) => p.join(',')).join('L')}Z" fill="${l.c}" fill-opacity=".92" stroke="#fffdf8" stroke-width="1"/>`;
    l.v.forEach((v, i) => (base[i] += v));
  }
  const ticks = [0, 1, 2, 3, 4].map((k) => ({ v: (top * k) / 4, y: Y((top * k) / 4) }));
  const step = Math.ceil(n / (w < 520 ? 4 : 8));
  el.innerHTML = legend(layers.map((l) => ({ n: l.n, c: l.c }))) + `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Stacked MRR by plan">${axes(f, ticks, usd, months.map((m, i) => ({ x: X(i), t: mLabel(m) })), step)}${paths}</svg>`;
  hover(el, f, months.map((_, i) => X(i)), (i) => tipRows(mLabel(months[i]), [...layers].reverse().map((l) => ({ n: l.n, c: l.c, v: usd(l.v[i]) })).concat([{ n: 'Total', c: '#f5f1e8', v: usd(tot[i]) }])));
}

export function movements(el, months, parts, w) {
  const h = w < 520 ? 240 : 300; const f = frame(w, h, { l: 46, r: 8, t: 10, b: 26 });
  const n = months.length; const pos = months.map((_, i) => parts.slice(0, 2).reduce((a, p) => a + p.v[i], 0)); const neg = months.map((_, i) => parts.slice(2).reduce((a, p) => a + p.v[i], 0));
  const up = nice(Math.max(...pos)); const dn = nice(Math.max(...neg)); const span = up + dn;
  const Y = (v) => f.m.t + (f.ih * (up - v)) / span; const bw = Math.max(3, (f.iw / n) * 0.66); const X = (i) => f.m.l + (f.iw * (i + 0.5)) / n;
  let bars = '';
  months.forEach((_, i) => {
    let a = 0; for (const p of parts.slice(0, 2)) { bars += `<rect x="${X(i) - bw / 2}" y="${Y(a + p.v[i])}" width="${bw}" height="${Math.max(0, Y(a) - Y(a + p.v[i]))}" fill="${p.c}"/>`; a += p.v[i]; }
    a = 0; for (const p of parts.slice(2)) { bars += `<rect x="${X(i) - bw / 2}" y="${Y(-a)}" width="${bw}" height="${Math.max(0, Y(-a - p.v[i]) - Y(-a))}" fill="${p.c}"/>`; a += p.v[i]; }
  });
  const ts = []; for (let v = -dn; v <= up + 1e-6; v += span / 6) ts.push({ v, y: Y(v) });
  const net = months.map((_, i) => pos[i] - neg[i]);
  const line = `<path d="M${net.map((v, i) => `${X(i)},${Y(v)}`).join('L')}" fill="none" stroke="#1c2420" stroke-width="1.8" stroke-linejoin="round"/>`;
  const step = Math.ceil(n / (w < 520 ? 4 : 8));
  el.innerHTML = legend([...parts.map((p) => ({ n: p.n, c: p.c })), { n: 'Net new', c: '#1c2420' }]) + `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="MRR movements by month">${axes(f, ts, usd, months.map((m, i) => ({ x: X(i), t: mLabel(m) })), step)}<line x1="${f.m.l}" x2="${w - f.m.r}" y1="${Y(0)}" y2="${Y(0)}" stroke="#9aa39d"/>${bars}${line}</svg>`;
  hover(el, f, months.map((_, i) => X(i)), (i) => tipRows(mLabel(months[i]), [...parts.map((p, k) => ({ n: p.n, c: p.c, v: (k > 1 ? '−' : '+') + usd(p.v[i]) })), { n: 'Net new', c: '#f5f1e8', v: usd(net[i]) }]));
}

export function lines(el, months, series, w) {
  const h = w < 520 ? 220 : 250; const f = frame(w, h, { l: 40, r: 8, t: 10, b: 26 });
  const n = months.length; const top = nice(Math.max(...series.flatMap((s) => s.v)) * 1.1);
  const X = (i) => f.m.l + (f.iw * i) / (n - 1); const Y = (v) => f.m.t + f.ih - (v / top) * f.ih;
  const ticks = [0, 1, 2, 3, 4].map((k) => ({ v: (top * k) / 4, y: Y((top * k) / 4) }));
  const paths = series.map((s) => `<path d="M${s.v.map((v, i) => `${X(i)},${Y(v)}`).join('L')}" fill="none" stroke="${s.c}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`).join('');
  const step = Math.ceil(n / 4);
  el.innerHTML = legend(series) + `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Monthly churn rates">${axes(f, ticks, (v) => pct(v, 1), months.map((m, i) => ({ x: X(i), t: mLabel(m) })), step)}${paths}</svg>`;
  hover(el, f, months.map((_, i) => X(i)), (i) => tipRows(mLabel(months[i]), series.map((s) => ({ n: s.n, c: s.c, v: pct(s.v[i], 2) }))));
}

export function hbars(el, rows, w) {
  const rh = 46; const h = rows.length * rh + 18; const f = frame(w, h, { l: 70, r: 56, t: 6, b: 12 });
  const top = nice(Math.max(...rows.map((r) => r.v), 3) * 1.05);
  const X = (v) => f.m.l + (f.iw * v) / top;
  let s = `<line x1="${X(3)}" x2="${X(3)}" y1="0" y2="${h - 12}" stroke="#b8691a" stroke-dasharray="3 4"/><text x="${X(3)}" y="${h}" text-anchor="middle" fill="#9a5512">3× target</text>`;
  rows.forEach((r, i) => {
    const y = f.m.t + i * rh + 8;
    s += `<text x="0" y="${y + 17}" style="fill:#1c2420;font-weight:600">${r.n}</text><rect x="${f.m.l}" y="${y}" width="${f.iw}" height="22" rx="6" fill="#efe9da"/><rect x="${f.m.l}" y="${y}" width="${Math.max(2, X(r.v) - f.m.l)}" height="22" rx="6" fill="${r.c}" opacity="${r.on ? 1 : 0.35}"/><text x="${w}" y="${y + 16}" text-anchor="end" style="fill:#1c2420;font-weight:700;font-size:13px">${r.v.toFixed(1)}×</text>`;
  });
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="LTV to CAC ratio by plan">${s}</svg>`;
}

export function heat(el, rows, w, label) {
  const maxA = Math.max(...rows.map((r) => r.cells.length)); const lw = w < 520 ? 44 : 74; const sw = w < 520 ? 0 : 44;
  const cw = (w - lw - sw) / maxA; const ch = w < 520 ? 24 : 28; const h = 22 + rows.length * ch + 6;
  const col = (v) => { const t = Math.max(0, Math.min(1, (v - 0.2) / 0.8)); const a = [239, 233, 218], b = [31, 111, 84]; return `rgb(${a.map((x, k) => Math.round(x + (b[k] - x) * t)).join(',')})`; };
  let s = '';
  for (let a = 0; a < maxA; a++) if (a % (w < 520 ? 2 : 1) === 0) s += `<text x="${lw + sw + a * cw + cw / 2}" y="12" text-anchor="middle">${a}</text>`;
  if (sw) s += `<text x="${lw + sw - 6}" y="12" text-anchor="end">Size</text>`;
  rows.forEach((r, i) => {
    const y = 22 + i * ch;
    s += `<text x="0" y="${y + ch / 2 + 4}">${mLabel(r.month)}</text>`;
    if (sw) s += `<text x="${lw + sw - 6}" y="${y + ch / 2 + 4}" text-anchor="end">${r.size}</text>`;
    r.cells.forEach((v, a) => {
      if (v === null) return;
      const x = lw + sw + a * cw;
      s += `<rect x="${x + 1}" y="${y + 1}" width="${cw - 2}" height="${ch - 2}" rx="4" fill="${col(v)}"><title>${mLabel(r.month)} · month ${a}: ${pct(v, 0)} ${label}</title></rect>`;
      if (cw > 30) s += `<text x="${x + cw / 2}" y="${y + ch / 2 + 4}" text-anchor="middle" style="fill:${v > 0.6 ? '#fff' : '#1c2420'};font-size:${cw > 38 ? 11 : 10}px">${Math.round(v * 100)}</text>`;
    });
  });
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Cohort retention heatmap, rows are signup months, columns are months since signup">${s}</svg><p class="axis-note" style="margin:6px 0 4px;font-size:12px;color:#5b655f">Columns: months since signup. Cells: % of the cohort ${label}.</p>`;
}
