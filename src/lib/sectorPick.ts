import type { Dataset, FactorKey, Horizon, Risk } from './types'
import type { Holding } from './auth'
import { FACTOR_LABEL, computeMetrics, scoreUniverse } from './engine'
import { plain } from './format'

/**
 * 보유 종목을 아는 경우(계좌 연결, 거래내역) 보완하면 좋을 업종을 고른다.
 * 1) 전체 종목을 종합 점수(성향·기간 가중치)로 줄 세워 상위 20%를 '상위 종목'으로 본다.
 * 2) 보유 비중이 10% 미만인 업종 중, 상위 종목이 들어 있는 업종만 후보로 둔다.
 * 3) 상위 종목이 많은 업종부터, 같으면 업종 안에서 상위 종목의 비율이 높은 쪽, 그래도 같으면 상위 종목의 평균 점수가 높은 쪽 순으로 최대 3개를 고른다.
 *    후보가 하나도 없으면 상위 범위를 30%, 40%로 넓힌다.
 * 근거로는 상위 종목 수와 비율, 상위 종목 점수에 가장 크게 기여한 지표를 보여 준다. 기준값(20%, 10%)은 검증 전 가정이다.
 */
export interface SectorSuggestion {
  id: string
  share: number
  /** 업종의 상위 종목들의 평균 점수 */
  avgScore: number
  topFactor: FactorKey
  /** 상위 종목 수와 업종 전체 종목 수 */
  topCount: number
  sectorSize: number
  /** 상위로 본 범위(전체 종목 중 비율) */
  topFrac: number
  reason: string
}

const UNDERWEIGHT = 0.1
const MAX_SUGGEST = 3
const TOP_FRACS = [0.2, 0.3, 0.4]
const FACTORS: FactorKey[] = ['ret20', 'ret60', 'ret120', 'volRatio', 'stability']

export function suggestSectors(data: Dataset, portfolio: Holding[], risk: Risk, horizon: Horizon): SectorSuggestion[] {
  const byCode = new Map(data.stocks.map((s) => [s.code, s]))
  const held = portfolio.filter((h) => h.qty > 0 && byCode.has(h.code))
  if (held.length === 0) return []

  const value: Record<string, number> = {}
  let total = 0
  for (const h of held) {
    const s = byCode.get(h.code)!
    const v = computeMetrics(s).price * h.qty
    value[s.sector] = (value[s.sector] ?? 0) + v
    total += v
  }

  const scores = scoreUniverse(data, risk, horizon)
  const ranked = data.stocks
    .map((s) => ({ s, sc: scores.get(s.code)! }))
    .sort((a, b) => b.sc.score - a.sc.score)

  for (const frac of TOP_FRACS) {
    const topN = Math.max(1, Math.ceil(ranked.length * frac))
    const top = ranked.slice(0, topN)
    const candidates = Object.keys(data.sectors)
      .map((id) => {
        const members = top.filter((x) => x.s.sector === id)
        const sectorSize = data.stocks.filter((s) => s.sector === id).length
        const avgScore = members.length ? members.reduce((a, x) => a + x.sc.score, 0) / members.length : 0
        const avgContrib = Object.fromEntries(
          FACTORS.map((k) => [k, members.length ? members.reduce((a, x) => a + x.sc.contrib[k], 0) / members.length : 0]),
        ) as Record<FactorKey, number>
        const topFactor = [...FACTORS].sort((a, b) => avgContrib[b] - avgContrib[a])[0]
        return {
          id,
          share: (value[id] ?? 0) / total,
          avgScore,
          topFactor,
          topCount: members.length,
          sectorSize,
          topShare: sectorSize ? members.length / sectorSize : 0,
        }
      })
      .filter((c) => c.share < UNDERWEIGHT && c.topCount > 0)
      .sort((a, b) => b.topCount - a.topCount || b.topShare - a.topShare || b.avgScore - a.avgScore)

    if (candidates.length === 0) continue
    return candidates.slice(0, MAX_SUGGEST).map(({ topShare, ...c }) => ({
      ...c,
      topFrac: frac,
      reason: `종합 점수 상위 ${topN}개 중 ${c.topCount}개가 이 업종(업종 종목 ${c.sectorSize}개 중 ${plain(topShare, 0)}), 보유 비중 ${plain(c.share, 0)}. 상위 종목의 가장 큰 요인: ${FACTOR_LABEL[c.topFactor]}`,
    }))
  }
  return []
}
