// 점수 요인별 순위 상관(IC)과 상위 5종목 초과수익을 과거 시점마다 계산하는 간이 검증.
// 입력: src/data/stocks.json(43종목, 125거래일). 시점 t에서는 t까지의 자료만 쓰고, 이후 20거래일 수익률과 비교한다.
const fs = require('fs')
const data = JSON.parse(fs.readFileSync('E:/JIHWAN/IDE/workplace/saeum_mini/app/src/data/stocks.json', 'utf8'))
const S = data.stocks
const N = S[0].close.length
const H = 20 // 이후 20거래일(약 1개월)
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length
const std = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))) }

function ranks(a) {
  const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0])
  const r = new Array(a.length)
  let i = 0
  while (i < idx.length) {
    let j = i
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++
    const avg = (i + j) / 2
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg
    i = j + 1
  }
  return r
}
const pct = (a) => ranks(a).map((r) => (r / (a.length - 1)) * 100)
function spearman(x, y) {
  const rx = ranks(x), ry = ranks(y)
  const mx = mean(rx), my = mean(ry)
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < x.length; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2 }
  return num / Math.sqrt(dx * dy)
}

// 성향별 가중치(새 방식 = 1개월 제외 모멘텀, 옛 방식 = 1개월 포함). 6개월 요인은 자료 길이 때문에 이 검증에서는 뺀다(남은 가중치로 다시 맞춤).
const OLD = {
  stable: { r20: 0.05, r60: 0.15, vr: 0.05, st: 0.65 },
  stablePlus: { r20: 0.1, r60: 0.2, vr: 0.1, st: 0.5 },
  neutral: { r20: 0.2, r60: 0.2, vr: 0.15, st: 0.3 },
  active: { r20: 0.25, r60: 0.2, vr: 0.25, st: 0.15 },
  aggressive: { r20: 0.3, r60: 0.2, vr: 0.3, st: 0.1 },
}
const NEW = {
  stable: { r20: 0, r60: 0.17, vr: 0.06, st: 0.65 },
  stablePlus: { r20: 0, r60: 0.25, vr: 0.12, st: 0.5 },
  neutral: { r20: 0, r60: 0.3, vr: 0.18, st: 0.3 },
  active: { r20: 0, r60: 0.33, vr: 0.3, st: 0.15 },
  aggressive: { r20: 0, r60: 0.35, vr: 0.35, st: 0.1 },
}
const norm = (w) => { const s = Object.values(w).reduce((a, b) => a + b, 0); return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v / s])) }

const series = { f_ret20: [], f_mom60: [], f_ret60plain: [], f_volRatio: [], f_lowVol: [] }
const comp = {}
for (const [name, W] of [['old', OLD], ['new', NEW]]) for (const r of Object.keys(W)) comp[name + ':' + r] = { ic: [], spread: [] }
const dates = []

for (let t = 60; t + H < N; t++) {
  dates.push(S[0].dates[t])
  const f = { r20: [], m60: [], r60: [], vr: [], vol: [] }
  const fwd = []
  for (const s of S) {
    const c = s.close, v = s.volume
    f.r20.push(c[t] / c[t - 20] - 1)
    f.m60.push(c[t - 20] / c[t - 60] - 1)
    f.r60.push(c[t] / c[t - 60] - 1)
    f.vr.push(mean(v.slice(t - 4, t + 1)) / mean(v.slice(t - 59, t + 1)))
    const rets = []
    for (let i = t - 59; i <= t; i++) rets.push(c[i] / c[i - 1] - 1)
    f.vol.push(std(rets))
    fwd.push(c[t + H] / c[t] - 1)
  }
  const uni = mean(fwd)
  series.f_ret20.push(spearman(f.r20, fwd))
  series.f_mom60.push(spearman(f.m60, fwd))
  series.f_ret60plain.push(spearman(f.r60, fwd))
  series.f_volRatio.push(spearman(f.vr, fwd))
  series.f_lowVol.push(spearman(f.vol.map((x) => -x), fwd))
  const P = { r20: pct(f.r20), m60: pct(f.m60), r60: pct(f.r60), vr: pct(f.vr), st: pct(f.vol).map((p) => 100 - p) }
  for (const [name, W, key] of [['old', OLD, 'r60'], ['new', NEW, 'm60']]) {
    for (const r of Object.keys(W)) {
      const w = norm(W[r])
      const score = S.map((_, i) => w.r20 * P.r20[i] + w.r60 * P[key][i] + w.vr * P.vr[i] + w.st * P.st[i])
      const ic = spearman(score, fwd)
      const top = score.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]).slice(0, 5).map((x) => fwd[x[1]])
      comp[name + ':' + r].ic.push(ic)
      comp[name + ':' + r].spread.push(mean(top) - uni)
    }
  }
}
const summarize = (a) => {
  const m = mean(a), s = std(a)
  const nEff = Math.ceil(a.length / H) // 20거래일 겹치므로 서로 겹치지 않는 표본 수의 대략값
  return { mean: +m.toFixed(3), sd: +s.toFixed(3), n: a.length, nEff, tNaive: +((m / (s / Math.sqrt(a.length))) || 0).toFixed(2), tConservative: +((m / (s / Math.sqrt(nEff))) || 0).toFixed(2), pos: +(a.filter((x) => x > 0).length / a.length).toFixed(2) }
}
const out = { period: [dates[0], dates[dates.length - 1]], horizonDays: H, universe: S.length, factors: {}, composites: {} }
for (const k of Object.keys(series)) out.factors[k] = summarize(series[k])
for (const k of Object.keys(comp)) out.composites[k] = { ic: summarize(comp[k].ic), top5Spread: +(mean(comp[k].spread) * 100).toFixed(2) }
console.log(JSON.stringify(out, null, 1))
