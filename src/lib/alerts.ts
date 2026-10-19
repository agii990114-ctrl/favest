import type { Alert, Stock } from './types'
import { computeMetrics } from './engine'
import { plain, signed } from './format'

/** 관심·보유·추천 종목에 규칙을 적용해 주의가 필요한 항목을 찾는다. 기준일 시점의 점검이며 실시간 감시가 아니다. */
export function checkAlerts(stocks: Stock[]): Alert[] {
  const alerts: Alert[] = []
  for (const s of stocks) {
    const m = computeMetrics(s)
    const base = { code: s.code, name: s.name }

    if (m.vol > 0 && m.recentVol / m.vol >= 1.5) {
      alerts.push({
        ...base,
        level: 'warn',
        title: '변동성 확대',
        detail: `최근 1주 변동성이 3개월 평균의 ${(m.recentVol / m.vol).toFixed(1)}배입니다.`,
      })
    }
    if (m.ret1 <= -0.08) {
      alerts.push({
        ...base,
        level: 'warn',
        title: '하루 급락',
        detail: `기준일 하루 등락률이 ${signed(m.ret1)}였습니다.`,
      })
    } else if (m.ret5 <= -0.07) {
      alerts.push({
        ...base,
        level: 'warn',
        title: '단기 하락',
        detail: `최근 1주 수익률이 ${signed(m.ret5)}였습니다.`,
      })
    }
    if (m.volRatio >= 2.5) {
      alerts.push({
        ...base,
        level: 'info',
        title: '거래량 급증',
        detail: `최근 1주 평균 거래량이 3개월 평균의 ${m.volRatio.toFixed(1)}배입니다.`,
      })
    }
    if (m.drawdown <= -0.15) {
      alerts.push({
        ...base,
        level: 'info',
        title: '고점 대비 낙폭',
        detail: `3개월 고점 대비 ${plain(m.drawdown, 1)} 낮은 가격대입니다.`,
      })
    }
  }
  return alerts.sort((a, b) => (a.level === b.level ? 0 : a.level === 'warn' ? -1 : 1))
}

/** 주의 점검 기간(거래일 수) */
export const ALERT_PERIODS = [
  { key: '1d', label: '1일', days: 1 },
  { key: '1w', label: '1주', days: 5 },
  { key: '1m', label: '1개월', days: 20 },
  { key: '3m', label: '3개월', days: 60 },
  { key: '6m', label: '6개월', days: 120 },
] as const
export type AlertPeriodKey = (typeof ALERT_PERIODS)[number]['key']

/** 기간별 하락 기준(이 수익률 이하이면 확인 필요) — 과제용 가정 */
const DROP_LIMIT: Record<AlertPeriodKey, number> = { '1d': -0.05, '1w': -0.07, '1m': -0.1, '3m': -0.15, '6m': -0.2 }

const stdev = (a: number[]) => {
  if (a.length < 2) return 0
  const m = a.reduce((s, v) => s + v, 0) / a.length
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length)
}
const dailyRets = (c: number[]) => c.slice(1).map((x, i) => x / c[i] - 1)

/**
 * 고른 기간 안에서 '확인 필요' 수준의 신호만 찾는다.
 * - 하락: 기간 수익률이 기간별 기준 이하
 * - 변동성: 1일은 하루 등락이 평소(3개월) 일간 변동성의 3배 이상,
 *   1주·1개월은 기간 변동성이 3개월 평균의 1.5배 이상,
 *   3·6개월은 기간 변동성이 전체 종목 중 상위 15%
 * - 낙폭: 3·6개월은 기간 고점 대비 -20% 이하
 */
export function periodAlerts(stocks: Stock[], universe: Stock[], key: AlertPeriodKey): Alert[] {
  const days = ALERT_PERIODS.find((p) => p.key === key)!.days
  const windowVol = (s: Stock) => stdev(dailyRets(s.close.slice(-(days + 1))))
  const volRank = (() => {
    if (days < 60) return null
    const all = universe.map(windowVol).sort((a, b) => a - b)
    return (v: number) => all.filter((x) => x < v).length / Math.max(1, all.length - 1)
  })()

  const alerts: Alert[] = []
  for (const s of stocks) {
    const c = s.close
    const n = c.length
    const base = { code: s.code, name: s.name, level: 'warn' as const }
    const ret = c[n - 1] / c[Math.max(0, n - 1 - days)] - 1
    const vol3m = stdev(dailyRets(c.slice(-61)))
    const label = ALERT_PERIODS.find((p) => p.key === key)!.label

    if (ret <= DROP_LIMIT[key]) {
      alerts.push({ ...base, title: days === 1 ? '하루 급락' : '기간 하락', detail: `최근 ${label} 수익률이 ${signed(ret)}였습니다.` })
    }
    if (days === 1) {
      if (vol3m > 0 && Math.abs(ret) >= vol3m * 3 && ret > DROP_LIMIT[key]) {
        alerts.push({ ...base, title: '하루 변동 폭 확대', detail: `하루 등락 ${signed(ret)}로 평소 일간 변동성의 ${(Math.abs(ret) / vol3m).toFixed(1)}배입니다.` })
      }
    } else if (days < 60) {
      const ratio = vol3m > 0 ? windowVol(s) / vol3m : 0
      if (ratio >= 1.5) alerts.push({ ...base, title: '변동성 확대', detail: `최근 ${label} 변동성이 3개월 평균의 ${ratio.toFixed(1)}배입니다.` })
    } else {
      const rank = volRank!(windowVol(s))
      if (rank >= 0.85) alerts.push({ ...base, title: '변동성 상위', detail: `최근 ${label} 변동성이 전체 종목 중 상위 ${Math.max(1, Math.round((1 - rank) * 100))}%입니다.` })
      const peak = Math.max(...c.slice(-(days + 1)))
      const dd = c[n - 1] / peak - 1
      if (dd <= -0.2) alerts.push({ ...base, title: '고점 대비 큰 낙폭', detail: `최근 ${label} 고점 대비 ${plain(dd, 1)} 낮은 가격대입니다.` })
    }
  }
  return alerts
}
