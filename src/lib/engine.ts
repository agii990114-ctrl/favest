import type {
  Dataset,
  FactorKey,
  Horizon,
  Metrics,
  Pick,
  Profile,
  RecommendResult,
  Risk,
  Stock,
} from './types'
import { HORIZON_LABEL, RISK_LABEL, plain, signed } from './format'

const FACTORS: FactorKey[] = ['ret20', 'ret60', 'ret120', 'volRatio', 'stability']

export const FACTOR_LABEL: Record<FactorKey, string> = {
  ret20: '최근 1개월 수익률(참고)',
  ret60: '3개월 수익률(최근 1개월 제외)',
  ret120: '6개월 수익률(최근 1개월 제외)',
  volRatio: '거래량 증가',
  stability: '낮은 변동성',
}

/**
 * 성향별 기본 가중치 (과제용으로 설계한 가정값, 수익을 보장하지 않음).
 * 모멘텀(ret60, ret120)은 최근 1개월을 뺀 수익률로 계산한다(단기 반전 연구를 따름).
 * 1개월 수익률(ret20)은 점수에 넣지 않고 참고로만 보여 준다(가중치 0).
 */
export const BASE_WEIGHTS: Record<Risk, Record<FactorKey, number>> = {
  stable: { ret20: 0, ret60: 0.17, ret120: 0.12, volRatio: 0.06, stability: 0.65 },
  stablePlus: { ret20: 0, ret60: 0.25, ret120: 0.13, volRatio: 0.12, stability: 0.5 },
  neutral: { ret20: 0, ret60: 0.3, ret120: 0.22, volRatio: 0.18, stability: 0.3 },
  active: { ret20: 0, ret60: 0.33, ret120: 0.22, volRatio: 0.3, stability: 0.15 },
  aggressive: { ret20: 0, ret60: 0.35, ret120: 0.2, volRatio: 0.35, stability: 0.1 },
}

/** 거래일 기준 기간: 1주 5일, 1개월 20일, 3개월 60일, 6개월 120일 */
const D_1W = 5
const D_1M = 20
const D_3M = 60
const D_6M = 120

const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length
const std = (a: number[]) => {
  const m = mean(a)
  return Math.sqrt(mean(a.map((v) => (v - m) ** 2)))
}

export function computeMetrics(s: Stock): Metrics {
  const c = s.close
  const n = c.length
  const back = (days: number) => c[Math.max(0, n - 1 - days)]
  // 변동성·거래량·고점은 최근 3개월(60거래일) 기준으로 본다.
  const c3m = c.slice(-(D_3M + 1))
  const v3m = s.volume.slice(-D_3M)
  const rets = c3m.slice(1).map((x, i) => x / c3m[i] - 1)
  // 최근 3개월 중 고점에서 가장 크게 내려갔던 폭(최대 낙폭)
  let peak = c3m[0]
  let maxDrawdown = 0
  for (const x of c3m) {
    peak = Math.max(peak, x)
    maxDrawdown = Math.min(maxDrawdown, x / peak - 1)
  }
  return {
    price: c[n - 1],
    ret1: c[n - 1] / back(1) - 1,
    ret5: c[n - 1] / back(D_1W) - 1,
    ret20: c[n - 1] / back(D_1M) - 1,
    ret60: c[n - 1] / back(D_3M) - 1,
    ret120: c[n - 1] / back(D_6M) - 1,
    volRatio: mean(v3m.slice(-D_1W)) / mean(v3m),
    vol: std(rets),
    recentVol: std(rets.slice(-D_1W)),
    drawdown: c[n - 1] / Math.max(...c3m) - 1,
    maxDrawdown,
    mom60: back(D_1M) / back(D_3M) - 1,
    mom120: back(D_1M) / back(D_6M) - 1,
  }
}

/** 보유·거래 종목의 변동성 순위(0~1)로 투자성향 5단계를 추정한다. */
export function riskFromRank(rank: number): Risk {
  return rank < 0.2 ? 'stable' : rank < 0.4 ? 'stablePlus' : rank < 0.6 ? 'neutral' : rank < 0.8 ? 'active' : 'aggressive'
}

/** 투자 기간에 따라 가중치를 보정한 뒤 합이 1이 되도록 다시 맞춘다. */
export function adjustedWeights(risk: Risk, horizon: Horizon): Record<FactorKey, number> {
  const w = { ...BASE_WEIGHTS[risk] }
  if (horizon === 'short') {
    w.volRatio *= 1.3
    w.ret60 *= 1.3
    w.ret120 *= 0.5
  } else if (horizon === 'long') {
    w.ret120 *= 1.5
    w.ret60 *= 1.2
    w.stability *= 1.2
  }
  const sum = FACTORS.reduce((s, k) => s + w[k], 0)
  for (const k of FACTORS) w[k] /= sum
  return w
}

function percentiles(values: number[]): number[] {
  const n = values.length
  if (n === 1) return [50]
  return values.map((v) => {
    const below = values.filter((x) => x < v).length
    const equal = values.filter((x) => x === v).length
    return ((below + (equal - 1) / 2) / (n - 1)) * 100
  })
}

function quantile(values: number[], q: number) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]
}

/** 필터 없이 전체 종목의 점수와 지표별 기여도(성향·기간 가중치 적용)를 계산한다. 업종 추천 등에 쓴다. */
export function scoreUniverse(
  data: Dataset,
  risk: Risk,
  horizon: Horizon,
): Map<string, { score: number; contrib: Record<FactorKey, number> }> {
  const weights = adjustedWeights(risk, horizon)
  const ms = data.stocks.map((s) => computeMetrics(s))
  const pct: Record<FactorKey, number[]> = {
    ret20: percentiles(ms.map((m) => m.ret20)),
    ret60: percentiles(ms.map((m) => m.mom60)),
    ret120: percentiles(ms.map((m) => m.mom120)),
    volRatio: percentiles(ms.map((m) => m.volRatio)),
    stability: percentiles(ms.map((m) => m.vol)).map((p) => 100 - p),
  }
  return new Map(
    data.stocks.map((s, i) => {
      const contrib = {} as Record<FactorKey, number>
      for (const k of FACTORS) contrib[k] = pct[k][i] * weights[k]
      return [s.code, { score: FACTORS.reduce((acc, k) => acc + contrib[k], 0), contrib }]
    }),
  )
}

/** 안정형·안정추구형은 한 종목에 쏠리지 않도록 종목 수를 1개 늘린다. */
const pickCount = (budget: number, risk: Risk) =>
  (budget < 1_000_000 ? 3 : budget < 5_000_000 ? 4 : 5) + (risk === 'stable' || risk === 'stablePlus' ? 1 : 0)

/** 보수적 성향 기준: 변동성 하위 비율, 3개월 최대 낙폭 한도, 종목당 최대 비중 */
const CONSERVATIVE: Partial<Record<Risk, { volKeep: number; maxDrawdown: number; maxWeight: number }>> = {
  stable: { volKeep: 0.5, maxDrawdown: -0.2, maxWeight: 0.25 },
  stablePlus: { volKeep: 0.6, maxDrawdown: -0.25, maxWeight: 0.3 },
}

const MAX_PER_SECTOR = 2
const MAX_WEIGHT = 0.4
const PRICE_LIMIT_RATIO = 0.5

export function recommend(data: Dataset, profile: Profile): RecommendResult {
  const { budget, risk, horizon } = profile
  const weights = adjustedWeights(risk, horizon)
  const excluded: Record<string, number> = {}
  const notices: string[] = []
  const bump = (reason: string) => {
    excluded[reason] = (excluded[reason] ?? 0) + 1
  }

  const all = data.stocks.map((stock) => ({ stock, m: computeMetrics(stock) }))
  // 안정형은 변동성 하위 50%, 안정추구형은 하위 60%만 후보로 두고, 3개월 최대 낙폭이 한도를 넘은 종목도 뺀다.
  const conservative = CONSERVATIVE[risk]
  const volCut = conservative ? quantile(all.map((x) => x.m.vol), conservative.volKeep) : Infinity
  const held = new Set(profile.holdings)

  let pool = all.filter((x) => {
    if (held.has(x.stock.code)) {
      bump('이미 보유 중인 종목')
      return false
    }
    if (x.m.price > budget * PRICE_LIMIT_RATIO) {
      bump('1주 가격이 예산의 50% 초과')
      return false
    }
    if (conservative && x.m.vol > volCut) {
      bump(risk === 'stable' ? '안정형 기준 변동성 상위 50%' : '안정추구형 기준 변동성 상위 40%')
      return false
    }
    if (conservative && x.m.maxDrawdown < conservative.maxDrawdown) {
      bump('최근 3개월 최대 낙폭이 큼')
      return false
    }
    return true
  })

  // 고른 업종의 종목을 먼저 담는다. 후보가 목표 개수보다 적으면 모자란 만큼만 다른 업종에서 채운다.
  const want = pickCount(budget, risk)
  let preferred: Set<string> | null = null
  let sectorNote: string | undefined
  if (profile.sectors.length > 0) {
    const inSector = pool.filter((x) => profile.sectors.includes(x.stock.sector))
    if (inSector.length >= want) {
      const dropped = pool.length - inSector.length
      if (dropped > 0) excluded['관심 섹터가 아님'] = dropped
      pool = inSector
    } else {
      preferred = new Set(inSector.map((x) => x.stock.code))
    }
  } else {
    notices.push('업종을 좁히지 않아 전체 업종에서 골랐습니다.')
  }

  const empty: RecommendResult = {
    picks: [],
    invested: 0,
    cash: budget,
    weights,
    excluded,
    notices: [...notices, '조건에 맞는 종목이 없습니다. 예산을 늘리거나 조건을 바꿔 보십시오.'],
    candidateCount: 0,
  }
  if (pool.length === 0) return empty

  // 전체 종목을 기준으로 지표를 0~100 백분위로 환산 (후보가 적어도 비교 기준이 흔들리지 않게)
  const universe = new Map(all.map((x, i) => [x.stock.code, i]))
  const u20 = percentiles(all.map((x) => x.m.ret20))
  const u60 = percentiles(all.map((x) => x.m.mom60))
  const u120 = percentiles(all.map((x) => x.m.mom120))
  const uVol = percentiles(all.map((x) => x.m.volRatio))
  const uStab = percentiles(all.map((x) => x.m.vol)).map((p) => 100 - p)
  const at = (arr: number[], code: string) => arr[universe.get(code)!]
  const p20 = pool.map((x) => at(u20, x.stock.code))
  const p60 = pool.map((x) => at(u60, x.stock.code))
  const p120 = pool.map((x) => at(u120, x.stock.code))
  const pVol = pool.map((x) => at(uVol, x.stock.code))
  const pStab = pool.map((x) => at(uStab, x.stock.code))

  // 보유 종목이 있으면 아직 담지 않은 섹터에 소폭 가산(분산)
  const heldSectors = new Set(
    data.stocks.filter((s) => held.has(s.code)).map((s) => s.sector),
  )
  const DIVERSIFY_BONUS = 5

  const scored = pool
    .map((x, i) => {
      const pct: Record<FactorKey, number> = {
        ret20: p20[i],
        ret60: p60[i],
        ret120: p120[i],
        volRatio: pVol[i],
        stability: pStab[i],
      }
      const contrib = {} as Record<FactorKey, number>
      let score = 0
      for (const k of FACTORS) {
        contrib[k] = pct[k] * weights[k]
        score += contrib[k]
      }
      if (heldSectors.size > 0 && !heldSectors.has(x.stock.sector)) score += DIVERSIFY_BONUS
      return { ...x, pct, contrib, score }
    })
    .sort((a, b) => (preferred ? Number(preferred.has(b.stock.code)) - Number(preferred.has(a.stock.code)) : 0) || b.score - a.score)

  if (heldSectors.size > 0) {
    notices.push('보유 종목과 겹치지 않는 업종에 가산점을 주어 분산을 고려했습니다.')
  }

  // 섹터당 최대 2종목으로 분산하며 상위 선정 (후보 업종이 적으면 상한을 넓힌다)
  const n = Math.min(want, scored.length)
  const sectorsInPool = new Set(scored.map((x) => x.stock.sector)).size
  const sectorCap = Math.max(MAX_PER_SECTOR, Math.ceil(n / sectorsInPool))
  if (sectorCap > MAX_PER_SECTOR) {
    notices.push('고른 업종이 적어서 같은 업종에서 더 많은 종목을 담았습니다.')
  }
  const chosen: typeof scored = []
  const perSector: Record<string, number> = {}
  for (const x of scored) {
    if (chosen.length >= n) break
    if (!preferred?.has(x.stock.code) && (perSector[x.stock.sector] ?? 0) >= sectorCap) continue
    chosen.push(x)
    perSector[x.stock.sector] = (perSector[x.stock.sector] ?? 0) + 1
  }

  if (preferred) {
    const mine = chosen.filter((x) => preferred.has(x.stock.code)).length
    const names = profile.sectors.map((id) => data.sectors[id] ?? id).join(', ')
    sectorNote =
      mine === 0
        ? `선택한 업종(${names})에 조건에 맞는 종목이 없어 전체 업종에서 골랐습니다.`
        : `선택한 업종(${names})에서 조건에 맞는 종목이 ${mine}개뿐이라, 나머지 ${chosen.length - mine}개는 다른 업종에서 채웠습니다.`
  }

  // 점수 비례 배분 (종목당 최대 40%)
  const cap = Math.max(conservative?.maxWeight ?? MAX_WEIGHT, 1 / chosen.length)
  const total = chosen.reduce((s, x) => s + Math.max(x.score, 1), 0)
  let w = chosen.map((x) => Math.max(x.score, 1) / total)
  for (let it = 0; it < 10 && w.some((x) => x > cap + 1e-9); it++) {
    const fixed = w.map((x) => x > cap)
    const fixedSum = fixed.filter(Boolean).length * cap
    const freeSum = w.reduce((s, x, i) => (fixed[i] ? s : s + x), 0)
    w = w.map((x, i) => (fixed[i] ? cap : (x / freeSum) * (1 - fixedSum)))
  }

  // 정수 주 단위로 내림 후, 남은 현금으로 목표 비중에 가장 못 미친 종목부터 1주씩 추가
  const shares = chosen.map((x, i) => Math.floor((budget * w[i]) / x.m.price))
  let cash = budget - shares.reduce((s, q, i) => s + q * chosen[i].m.price, 0)
  for (;;) {
    let best = -1
    let bestGap = -Infinity
    chosen.forEach((x, i) => {
      if (x.m.price > cash) return
      const gap = budget * w[i] - shares[i] * x.m.price
      if (gap > bestGap) {
        bestGap = gap
        best = i
      }
    })
    if (best < 0) break
    shares[best] += 1
    cash -= chosen[best].m.price
  }

  const final = chosen
    .map((x, i) => ({ x, qty: shares[i] }))
    .filter(({ qty }) => qty > 0)
  const invested = final.reduce((s, { x, qty }) => s + qty * x.m.price, 0)

  const picks: Pick[] = final.map(({ x, qty }) => {
    const cost = qty * x.m.price
    const pick: Pick = {
      stock: x.stock,
      metrics: x.m,
      score: x.score,
      pct: x.pct,
      contrib: x.contrib,
      weight: cost / invested,
      shares: qty,
      cost,
      reasons: [],
      cautions: [],
    }
    explain(pick, profile, all.length)
    return pick
  })

  return {
    picks,
    invested,
    cash: budget - invested,
    weights,
    excluded,
    notices,
    sectorNote,
    candidateCount: pool.length,
  }
}

const topPct = (pct: number) => Math.max(1, Math.round(100 - pct))

/** 과거 수치를 서술하는 문장만 만든다 (전망·예측 표현은 쓰지 않는다). */
function explain(p: Pick, profile: Profile, total: number) {
  const m = p.metrics
  const retLine = (label: string, r: number, pct: number) =>
    r >= 0
      ? `${label}이 ${signed(r)}로 전체 ${total}개 종목 중 상위 ${topPct(pct)}%였습니다.`
      : `${label}은 ${signed(r)}로 하락했지만, 전체 ${total}개 종목 중 상위 ${topPct(pct)}%로 상대적으로 덜 떨어졌습니다.`
  const line: Record<FactorKey, string> = {
    ret20: retLine('최근 1개월 수익률', m.ret20, p.pct.ret20),
    ret60: retLine('최근 1개월을 뺀 3개월 수익률', m.mom60, p.pct.ret60),
    ret120: retLine('최근 1개월을 뺀 6개월 수익률', m.mom120, p.pct.ret120),
    volRatio: `최근 1주 평균 거래량이 3개월 평균의 ${m.volRatio.toFixed(1)}배로 전체 ${total}개 종목 중 상위 ${topPct(p.pct.volRatio)}%였습니다.`,
    stability: `일간 변동성이 ${plain(m.vol, 2)}로 전체 ${total}개 종목 중 변동성이 낮은 쪽 상위 ${topPct(p.pct.stability)}%였습니다.`,
  }
  const top = [...FACTORS].sort((a, b) => p.contrib[b] - p.contrib[a]).slice(0, 2)
  p.reasons.push(
    `${RISK_LABEL[profile.risk]}·${HORIZON_LABEL[profile.horizon]} 기준에서 비중이 큰 '${FACTOR_LABEL[top[0]]}'과(와) '${FACTOR_LABEL[top[1]]}' 점수가 높았습니다.`,
  )
  for (const k of top) p.reasons.push(line[k])

  if (m.ret20 < 0) p.cautions.push(`최근 1개월 수익률은 ${signed(m.ret20)}로 약세 구간이었습니다.`)
  if (m.drawdown <= -0.1)
    p.cautions.push(`3개월 고점 대비 ${plain(m.drawdown, 1)} 낮은 가격대입니다.`)
  if (p.pct.stability <= 20)
    p.cautions.push(`일간 변동성이 ${plain(m.vol, 2)}로 전체 종목 중 큰 편(상위 ${topPct(100 - p.pct.stability)}%)입니다.`)
}
