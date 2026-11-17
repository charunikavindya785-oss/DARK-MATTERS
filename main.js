/* QueuePulse: discrete-event queue simulation, baseline vs smart allocation */
const $ = s => document.querySelector(s), R = document.documentElement;
const SP = [1.15, .85, 1, .8, 1.1, .9, 1.05, .95];            // counter speed factors
const dpr = Math.min(2, window.devicePixelRatio || 1), col = {};
let K, N, pat, bm, rate, DUR, BL, run = false, fin = false, T = 0, ptr = 0, ns = 0;
let cust = [], A, B, hm = [], last = 0, fc = null, uid = 0, rk = '', imp = 0, tt, tl = -1;
const kv = { aw: 0, mw: 0, aq: 0, ut: 0, im: 0 };

function cols() {
  const s = getComputedStyle(R);
  ['ac', 'gd', 'wn', 'bd', 'tx', 'mu', 'ln', 'sf'].forEach(k => col[k] = s.getPropertyValue('--' + k).trim());
}
function toast(m) {
  const e = $('#toast'); e.textContent = m; e.classList.add('on');
  clearTimeout(tt); tt = setTimeout(() => e.classList.remove('on'), 2800);
}
const fmt = t => { const m = Math.floor(t) + 540; return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0') };

/* ---------- data generation ---------- */
function mk(at, r) {
  return { id: ++uid, at, st: 1.5 + r() * r() * 8 + r() * 2, pri: r() < .15, x: -15, y: null, tx: -15, ty: 0, a: 1 };
}
function gen() {
  DUR = N * 4.5 / (K * .92); BL = DUR / 12;
  const r = Math.random; cust = [];
  for (let i = 0; i < N; i++) {
    const u = r(); let at;
    if (pat === 'peak' && u < .6) at = DUR * (.5 + (r() + r() + r() - 1.5) * .18);
    else if (pat === 'surge' && u < .35) at = DUR * (.45 + r() * .08);
    else at = r() * DUR;
    cust.push(mk(Math.max(0, at), r));
  }
  cust.sort((a, b) => a.at - b.at);
}
function mkSys(s) {
  return { s, c: Array.from({ length: K }, (_, i) => ({ q: [], cur: null, end: 0, st0: 0, busy: 0, sp: SP[i] })), ex: [], waits: [], rr: 0, qs: [], log: [] };
}

/* ---------- allocation strategies ---------- */
function arrive(S, c0, t) {
  const c = { ...c0 }; let k = 0;
  if (S.s === 'b') {                                           // baseline
    if (bm === 'rr') k = S.rr++ % K;
    else { let b = 1e9; S.c.forEach((q, i) => { const l = q.q.length + (q.cur ? 1 : 0); if (l < b) { b = l; k = i } }) }
  } else {                                                     // smart: minimise estimated finish time
    let b = 1e9;
    S.c.forEach((q, i) => {
      const rem = q.cur ? Math.max(0, q.end - t) : 0, w = (rem + q.q.reduce((a, x) => a + x.st, 0) + c.st) / q.sp;
      if (w < b) { b = w; k = i }
    });
  }
  const Q = S.c[k].q;
  if (S.s === 's' && c.pri) { let j = 0; while (j < Q.length && Q[j].pri) j++; Q.splice(j, 0, c) } else Q.push(c);
}
function step(S, t, dt) {
  S.c.forEach((q, i) => {
    if (q.cur && t >= q.end) { S.ex.push(q.cur); q.cur = null }
    if (!q.cur && !q.q.length && S.s === 's') {               // idle counter steals from longest queue
      let m = null; S.c.forEach(o => { if (o.q.length > 1 && (!m || o.q.length > m.q.length)) m = o });
      if (m) q.q.push(m.q.pop());
    }
    if (!q.cur && q.q.length) {
      const c = q.q.shift(); q.cur = c; q.st0 = t; q.end = t + c.st / q.sp;
      S.waits.push(t - c.at); S.log.push([c.id, c.at, t, c.st / q.sp, c.pri, i]);
    }
    if (q.cur) { q.busy += dt; if (S.s === 's') hm[i][Math.min(11, Math.floor(t / BL))] += dt }
  });
}
function met(S, t) {
  const w = S.waits, n = w.length; let mw = 0;
  w.forEach(x => mw = Math.max(mw, x)); S.c.forEach(q => q.q.forEach(c => mw = Math.max(mw, t - c.at)));
  return {
    aw: n ? w.reduce((a, b) => a + b, 0) / n : 0, mw,
    aq: S.qs.length ? S.qs.reduce((a, p) => a + p[1], 0) / S.qs.length : 0,
    ut: t ? S.c.reduce((a, q) => a + q.busy, 0) / (K * t) * 100 : 0
  };
}

/* ---------- rendering ---------- */
function lanes(cv, S) {
  const g = cv.getContext('2d'), W = cv.clientWidth, H = cv.clientHeight;
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const lh = H / K, cx = W - 84; g.textAlign = 'center';
  const dot = c => {
    if (c.y === null) c.y = c.ty;
    c.x += (c.tx - c.x) * .16; c.y += (c.ty - c.y) * .16;
    g.globalAlpha = Math.max(0, c.a); g.beginPath(); g.arc(c.x, c.y, c.pri ? 6 : 5, 0, 7);
    g.fillStyle = c.pri ? col.wn : col.tx; g.fill();
    if (c.pri) { g.strokeStyle = col.tx; g.lineWidth = 1.5; g.stroke() }
    g.globalAlpha = 1;
  };
  S.c.forEach((q, i) => {
    const y = lh * i + lh / 2, n = q.q.length, sp = Math.min(15, (cx - 50) / Math.max(1, n));
    g.fillStyle = col.ln + '66'; g.beginPath(); g.roundRect(6, y - lh / 2 + 3, W - 12, lh - 6, 6); g.fill();
    q.q.forEach((c, j) => { c.tx = cx - 32 - j * sp; c.ty = y });
    const st = !q.cur ? col.gd : n >= 7 ? col.bd : n >= 4 ? col.wn : col.ac;
    g.fillStyle = st + '33'; g.strokeStyle = st; g.lineWidth = 2; g.beginPath(); g.roundRect(cx - 19, y - 17, 38, 34, 6); g.fill(); g.stroke();
    if (q.cur) {
      q.cur.tx = cx; q.cur.ty = y;
      const p = Math.min(1, (T - q.st0) / (q.end - q.st0));
      g.beginPath(); g.arc(cx, y, 22, -1.57, -1.57 + 6.283 * p); g.lineWidth = 3; g.stroke();
    }
    g.fillStyle = col.tx; g.font = '700 12px Figtree,system-ui'; g.fillText('C' + (i + 1), W - 26, y - 2);
    g.fillStyle = col.mu; g.font = '11px Figtree,system-ui'; g.fillText(n + ' wait', W - 26, y + 12);
  });
  S.c.forEach(q => { q.q.forEach(dot); if (q.cur) dot(q.cur) });
  S.ex = S.ex.filter(c => c.a > .02); S.ex.forEach(c => { c.tx = W + 30; c.a -= .015; dot(c) });
}
function chart() {
  const cv = $('#ch'), g = cv.getContext('2d'), W = cv.clientWidth, H = cv.clientHeight;
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const pl = 32, pb = 20, pt = 8, pw = W - pl - 8, ph = H - pb - pt, D = Math.max((cust.length ? cust[cust.length - 1].at : 60) * 1.3, T + 12), th = K * 1.5;
  const mx = Math.max(th * 1.6, ...A.qs.map(p => p[1]), ...B.qs.map(p => p[1])) * 1.1, X = t => pl + t / D * pw, Y = v => pt + ph - v / mx * ph;
  g.font = '10px Figtree,system-ui'; g.textAlign = 'right'; g.fillStyle = col.mu; g.strokeStyle = col.ln; g.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const y = Y(mx * i / 4); g.beginPath(); g.moveTo(pl, y); g.lineTo(W - 8, y); g.stroke(); g.fillText(Math.round(mx * i / 4), pl - 5, y + 3) }
  g.fillStyle = col.bd + '1a'; g.fillRect(pl, pt, pw, Y(th) - pt);                        // congestion zone
  g.setLineDash([5, 4]); g.strokeStyle = col.bd; g.beginPath(); g.moveTo(pl, Y(th)); g.lineTo(W - 8, Y(th)); g.stroke(); g.setLineDash([]);
  g.fillStyle = col.bd; g.textAlign = 'left'; g.fillText('congestion zone', pl + 6, Y(th) - 4);
  const ln = (S, c) => { if (S.qs.length < 2) return; g.strokeStyle = c; g.lineWidth = 2.2; g.beginPath(); S.qs.forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))); g.stroke() };
  ln(A, col.bd); ln(B, col.gd);
  fc = null; const P = A.qs.slice(-10);                                                     // linear-regression forecast
  if (P.length >= 6 && run) {
    const tm = P.reduce((a, p) => a + p[0], 0) / P.length, vm = P.reduce((a, p) => a + p[1], 0) / P.length; let n = 0, d = 0;
    P.forEach(p => { n += (p[0] - tm) * (p[1] - vm); d += (p[0] - tm) ** 2 });
    const s = d ? n / d : 0, t0 = P[P.length - 1][0];
    g.setLineDash([6, 5]); g.strokeStyle = col.wn; g.lineWidth = 2.2; g.beginPath(); g.moveTo(X(t0), Y(P[P.length - 1][1]));
    for (let k = 1; k <= 12; k++) { const t = t0 + k, v = Math.max(0, vm + s * (t - tm)); g.lineTo(X(Math.min(t, D)), Y(v)); if (fc === null && v > th) fc = k }
    g.stroke(); g.setLineDash([]);
  }
  g.fillStyle = col.mu; g.textAlign = 'center'; g.fillText('simulated time', W / 2, H - 4);
}
function heat() {
  const cv = $('#hm'), g = cv.getContext('2d'), W = cv.clientWidth, H = cv.clientHeight;
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const pl = 28, cw = (W - pl) / 12, ch = H / K; g.font = '11px Figtree,system-ui'; g.textAlign = 'right';
  hm.forEach((r, i) => {
    g.fillStyle = col.mu; g.fillText('C' + (i + 1), pl - 6, ch * i + ch / 2 + 4);
    r.forEach((v, j) => {
      g.fillStyle = col.ln + '66'; g.fillRect(pl + j * cw + 1, ch * i + 1, cw - 2, ch - 2);
      g.globalAlpha = Math.min(1, v / BL); g.fillStyle = col.ac; g.fillRect(pl + j * cw + 1, ch * i + 1, cw - 2, ch - 2); g.globalAlpha = 1;
    });
  });
}
function table() {
  if (B.log.length === tl) return; tl = B.log.length;
  $('#tb tbody').innerHTML = B.log.slice(-8).reverse().map(l =>
    `<tr><td>#${l[0]}</td><td>${fmt(l[1])}</td><td>${(l[2] - l[1]).toFixed(1)} min</td><td>C${l[5] + 1}</td><td>${l[4] ? 'Priority' : 'Standard'}</td></tr>`).join('');
}

/* ---------- comparison + recommendations ---------- */
const rows = [['Average wait', 'aw', ' min'], ['Longest wait', 'mw', ' min'], ['Utilisation', 'ut', '%']];
$('#cmp').innerHTML = rows.map((r, i) => `<div class="row"><div><span>${r[0]}</span><span id="v${i}"></span></div><div class="bb"><i id="a${i}" style="background:var(--bd)"></i></div><div class="bb"><i id="b${i}" style="background:var(--gd)"></i></div></div>`).join('') + '<div class="lg"><span><i style="background:var(--bd)"></i>Baseline</span><span><i style="background:var(--gd)"></i>Smart</span></div><div id="bdg"></div>';
function recs() {
  const o = [], q = A.c.map(c => c.q.length + (c.cur ? 1 : 0)), mx = Math.max(...q), mn = Math.min(...q);
  if (mx - mn >= 3) { const i = q.indexOf(mx), j = q.indexOf(mn); o.push(['bd', `Counter ${i + 1} is overloaded with ${mx} customers. Move staff or redirect arrivals to Counter ${j + 1}.`]) }
  if (fc !== null) o.push(['wn', `Congestion is forecast in about ${fc} min. Open an extra counter before the peak.`]);
  if (imp > 5) o.push(['gd', `Smart allocation is cutting the average wait by ${Math.round(imp)}% compared with the baseline.`]);
  if (!o.length) o.push(['gd', run || T ? 'Counters are balanced. No action needed right now.' : 'Press Run simulation to see live recommendations.']);
  const k = JSON.stringify(o);
  if (k !== rk) { rk = k; $('#rec').innerHTML = o.map(x => `<div class="rc k-${x[0]}"><span>${x[1]}</span>${x[0] === 'bd' ? '<button class="btn sm" data-apply>Apply</button>' : ''}</div>`).join('') }
}

/* ---------- main loop ---------- */
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
  if (run) {
    let adv = dt * rate;
    while (adv > 0) {
      const h = Math.min(.05, adv); adv -= h; T += h;
      while (ptr < cust.length && cust[ptr].at <= T) { arrive(A, cust[ptr], T); arrive(B, cust[ptr], T); ptr++ }
      step(A, T, h); step(B, T, h);
      if (T >= ns) { [A, B].forEach(s => s.qs.push([T, s.c.reduce((a, q) => a + q.q.length, 0)])); ns += .5 }
    }
    if (ptr >= cust.length && [A, B].every(s => s.c.every(q => !q.cur && !q.q.length))) {
      run = false; fin = true; lbl(); toast(`Done. Smart allocation cut the average wait by ${Math.round(imp)}%.`);
    }
  }
  if (!$('#p-simulator').hidden) { lanes($('#la'), A); lanes($('#lb'), B); chart(); heat(); table(); }
  const a = met(A, T), b = met(B, T); imp = a.aw > .05 ? (a.aw - b.aw) / a.aw * 100 : 0;
  const tg = { aw: b.aw, mw: b.mw, aq: b.aq, ut: b.ut, im: imp }; for (const k in tg) kv[k] += (tg[k] - kv[k]) * .2;
  $('#k-aw').textContent = kv.aw.toFixed(1) + ' min'; $('#k-mw').textContent = kv.mw.toFixed(1) + ' min';
  $('#k-aq').textContent = kv.aq.toFixed(1); $('#k-ut').textContent = Math.round(kv.ut) + '%';
  $('#k-im').textContent = (kv.im >= 0 ? '+' : '') + Math.round(kv.im) + '%';
  $('#ca').textContent = 'avg wait ' + a.aw.toFixed(1) + ' min'; $('#cb').textContent = 'avg wait ' + b.aw.toFixed(1) + ' min'; $('#clk').textContent = fmt(T);
  rows.forEach((r, i) => {
    const x = a[r[1]], y = b[r[1]], m = Math.max(x, y, .01);
    $('#a' + i).style.width = x / m * 100 + '%'; $('#b' + i).style.width = y / m * 100 + '%';
    $('#v' + i).textContent = x.toFixed(1) + ' vs ' + y.toFixed(1) + r[2];
  });
  $('#bdg').innerHTML = imp > 1 ? `<span class="badge">▲ ${Math.round(imp)}% shorter average wait</span>` : '';
  recs(); requestAnimationFrame(frame);
}

/* ---------- controls ---------- */
function lbl() { $('#go').textContent = run ? '⏸ Pause' : fin ? '↻ Run again' : T ? '▶ Resume' : '▶ Run simulation' }
function reset() {
  K = +$('#k').value; N = +$('#n').value; pat = $('#pat').value; bm = $('#bm').value; rate = +$('#sp').value * 1.5;
  gen(); A = mkSys('b'); B = mkSys('s'); hm = Array.from({ length: K }, () => Array(12).fill(0));
  T = 0; ptr = 0; ns = 0; fin = false; fc = null; rk = ''; tl = -1; for (const k in kv) kv[k] = 0;
  $('#la').style.height = $('#lb').style.height = K * 48 + 'px'; $('#hm').style.height = K * 26 + 'px';
  $('#ko').textContent = K; $('#no').textContent = N; $('#so').textContent = $('#sp').value + '×';
  $('#ta').textContent = 'Baseline: ' + (bm === 'rr' ? 'round-robin' : 'shortest queue'); cols();
}
['k', 'n', 'pat', 'bm'].forEach(i => $('#' + i).addEventListener('input', () => { run = false; reset(); lbl() }));
$('#sp').addEventListener('input', () => { rate = +$('#sp').value * 1.5; $('#so').textContent = $('#sp').value + '×' });
$('#go').onclick = () => { if (fin) { reset(); run = true } else run = !run; lbl() };
$('#rs').onclick = () => { run = false; reset(); lbl() };
$('#sg').onclick = () => {
  if (!run) { toast('Press Run first, then trigger a surge.'); return }
  for (let i = 0; i < 25; i++) cust.push(mk(T + .2 + Math.random() * 3, Math.random));
  cust.sort((a, b) => a.at - b.at); toast('⚡ Surge: 25 extra customers are arriving.');
};
window.addEventListener('themechange', cols);
document.addEventListener('click', e => {                       // apply recommendation: rebalance baseline queues
  if (!e.target.matches('[data-apply]')) return;
  let n = 0;
  for (let g = 0; g < 20; g++) {
    const Q = A.c, hi = Q.reduce((a, b) => b.q.length > a.q.length ? b : a), lo = Q.reduce((a, b) => b.q.length < a.q.length ? b : a);
    if (hi.q.length - lo.q.length < 2) break; lo.q.push(hi.q.pop()); n++;
  }
  toast(`Recommendation applied: moved ${n} customers to shorter queues in the baseline.`);
});
$('#ex').onclick = () => {                                      // CSV export of both strategies
  const r = ['strategy,customer,arrival_min,service_start_min,wait_min,service_min,priority,counter'];
  [[A, 'baseline'], [B, 'smart']].forEach(([S, n]) => S.log.forEach(l => r.push([n, l[0], l[1].toFixed(2), l[2].toFixed(2), (l[2] - l[1]).toFixed(2), l[3].toFixed(2), l[4] ? 1 : 0, l[5] + 1].join(','))));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([r.join('\n')], { type: 'text/csv' }));
  a.download = 'queuepulse-results.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500);
};
const ro = new ResizeObserver(es => es.forEach(e => { const c = e.target; c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr }));
['la', 'lb', 'ch', 'hm'].forEach(i => ro.observe($('#' + i)));
matchMedia('(prefers-color-scheme:dark)').addEventListener('change', cols);
function preset(q) {                                            // scenario presets: k, n, pat, bm, sp, auto, name
  const p = new URLSearchParams(q);
  ['k', 'n', 'pat', 'bm', 'sp'].forEach(i => { if (p.has(i)) $('#' + i).value = p.get(i) });
  $('#sn').textContent = p.get('name') || ''; run = false; reset(); if (p.get('auto')) run = true; lbl();
}
reset(); lbl(); requestAnimationFrame(frame);

/* ---- site shell: hash router, theme, hero ticket ---- */
(function () {
  const pages = ['home', 'simulator', 'scenarios', 'how-it-works'], titles = { home: 'QueuePulse', simulator: 'Simulator | QueuePulse', scenarios: 'Scenarios | QueuePulse', 'how-it-works': 'How it works | QueuePulse' };
  try { const t = localStorage.getItem('qp-theme'); if (t) { R.dataset.theme = t; cols() } } catch (e) {}
  function route() {
    const h = (location.hash || '#home').slice(1), p = pages.includes(h) ? h : 'home';
    pages.forEach(x => document.getElementById('p-' + x).hidden = x !== p);
    document.querySelectorAll('#nav nav a').forEach(a => a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + p));
    document.title = titles[p]; window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route); route();
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-preset]'); if (!a) return;
    e.preventDefault(); preset(a.dataset.preset); location.hash = '#simulator';
  });
  $('#th').onclick = () => {
    const d = R.dataset.theme ? R.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme:dark)').matches;
    R.dataset.theme = d ? 'light' : 'dark';
    try { localStorage.setItem('qp-theme', R.dataset.theme) } catch (e) {}
    cols();
  };
  const tk = $('#tk'); let n = 42;
  setInterval(() => { n = n % 99 + 1; tk.textContent = 'A' + String(n).padStart(3, '0'); tk.classList.remove('flip'); void tk.offsetWidth; tk.classList.add('flip') }, 1700);
})();
(function () {

function erlang(lam,s,c){const a=lam*s/60,r=a/c;if(r>=1)return{r,a,pw:1,wq:Infinity};
 let sum=0,t=1;for(let k=0;k<c;k++){sum+=t;t*=a/(k+1)}   // t ends as a^c / c!
 const top=t/(1-r),pw=top/(sum+top);return{r,a,pw,wq:pw*s/(c-a)}}
function calc(){const lam=+$('#lam').value,s=+$('#svc').value,c=Math.max(1,Math.floor(+$('#cc').value)),tw=+$('#tw').value;
 if(!(lam>0&&s>0&&tw>0))return;const e=erlang(lam,s,c);
 $('#o1').firstChild.textContent=Math.round(e.r*100)+'%';
 $('#o2').firstChild.textContent=e.r>=1?'Almost all':Math.round(e.pw*100)+'%';
 $('#o3').firstChild.textContent=e.wq===Infinity?'Unbounded':e.wq.toFixed(1)+' min';
 let need=c;while(need<60&&erlang(lam,s,need).wq>tw)need++;
 $('#o4').firstChild.textContent=need;
 $('#msg').textContent=e.r>=1?'Demand is higher than these counters can serve, so the queue grows all day. Open more counters.':
  e.wq>tw?`Average wait is above your target. Opening ${need-c} more counter${need-c>1?'s':''} would bring it to about ${erlang(lam,s,need).wq.toFixed(1)} min.`:
  'This staffing meets your target on average. Peaks and uneven counters can still cause long waits, so check them in the simulator.'}
['lam','svc','cc','tw'].forEach(i=>$('#'+i).addEventListener('input',calc));calc();
})();