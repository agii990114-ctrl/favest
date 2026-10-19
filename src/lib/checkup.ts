import type { Alert, Dataset, Risk } from './types'
import type { Holding } from './auth'
import { checkAlerts } from './alerts'
import { computeMetrics } from './engine'
import { RISK_LABEL, krw, plain } from './format'

/**
 * 내 계좌 점검(규칙 기반). 보유 종목을 기준일 종가로 평가하고, 쏠림·위험 신호·성향 적합도를 점검한다.
 * 문구는 현재 상태를 서술만 하고 매수·매도를 권하지 않는다. 임계값은 과제용 가정이다.
 */
export type CheckStatus = 'good' | 'warn' | 'info'

export interface CheckItem {
  id: string
  title: string
  status: CheckStatus
  detail: string
}

export interface CheckupRow {
  code: string
  name: string
  sector: string
  qty: number
  price: number
  value: number
  weight: number
  avgPrice?: number
  pnlRate?: number
  ret20: number
  alerts: Alert[]
}

export interface CheckupResult {
  rows: CheckupRow[]
  total: number
  pnl: number | null
  pnlRate: number | null
  cash: number | null
  sectors: { id: string; value: number; share: number }[]
  checks: CheckItem[]
  warnCount: number
}

const SECTOR_WARN = 0.4
const STOCK_WARN = 0.35
const VOL_LIMIT: Record<Risk, number> = { stable: 0.5, stablePlus: 0.6, neutral: 0.8, active: 0.9, aggressive: 1.01 }

export function runCheckup(
  data: Dataset,
  portfolio: Holding[],
  risk: Risk,
  cash: number | null,
): CheckupResult | null {
  const byCode = new Map(data.stocks.map((s) => [s.code, s]))
  const metrics = new Map(data.stocks.map((s) => [s.code, computeMetrics(s)]))
  const held = portfolio.filter((h) => h.qty > 0 && byCode.has(h.code))
  if (held.length === 0) return null

  const alerts = checkAlerts(held.map((h) => byCode.get(h.code)!))
  const base = held.map((h) => {
    const s = byCode.get(h.code)!
    const m = metrics.get(h.code)!
    return { h, s, m, value: m.price * h.qty }
  })
  const total = base.reduce((a, b) => a + b.value, 0)

  const rows: CheckupRow[] = base
    .map(({ h, s, m, value }) => ({
      code: s.code,
      name: s.name,
      sector: s.sector,
      qty: h.qty,
      price: m.price,
      value,
      weight: value / total,
      avgPrice: h.avgPrice,
      pnlRate: h.avgPrice ? m.price / h.avgPrice - 1 : undefined,
      ret20: m.ret20,
      alerts: alerts.filter((a) => a.code === s.code),
    }))
    .sort((a, b) => b.value - a.value)

  const withCost = rows.filter((r) => r.avgPrice)
  const cost = withCost.reduce((a, r) => a + (r.avgPrice ?? 0) * r.qty, 0)
  const pnl = withCost.length === rows.length && cost > 0 ? total - cost : null

  const sectorMap: Record<string, number> = {}
  for (const r of rows) sectorMap[r.sector] = (sectorMap[r.sector] ?? 0) + r.value
  const sectors = Object.entries(sectorMap)
    .map(([id, value]) => ({ id, value, share: value / total }))
    .sort((a, b) => b.value - a.value)

  const checks: CheckItem[] = []
  const name = (id: string) => data.sectors[id] ?? id

  // 1. 업종 쏠림
  const topSector = sectors[0]
  checks.push(
    topSector.share >= SECTOR_WARN
      ? {
          id: 'sector',
          title: '업종 쏠림',
          status: 'warn',
          detail: `${name(topSector.id)} 비중이 ${plain(topSector.share, 0)}입니다. 한 업종이 ${plain(SECTOR_WARN, 0)} 이상이면 그 업종 소식에 계좌 전체가 크게 흔들릴 수 있습니다.`,
        }
      : {
          id: 'sector',
          title: '업종 쏠림',
          status: 'good',
          detail: `가장 큰 업종(${name(topSector.id)})이 ${plain(topSector.share, 0)}로, 여러 업종에 나뉘어 있습니다.`,
        },
  )

  // 2. 종목 쏠림
  const topStock = rows[0]
  checks.push(
    topStock.weight >= STOCK_WARN
      ? {
          id: 'stock',
          title: '종목 쏠림',
          status: 'warn',
          detail: `${topStock.name} 한 종목이 주식 평가금액의 ${plain(topStock.weight, 0)}를 차지합니다.`,
        }
      : {
          id: 'stock',
          title: '종목 쏠림',
          status: 'good',
          detail: `가장 큰 종목(${topStock.name})도 ${plain(topStock.weight, 0)}로, 한 종목에 몰려 있지 않습니다.`,
        },
  )

  // 3. 위험 신호(단기 하락, 변동성 확대 등)
  const warned = rows.filter((r) => r.alerts.some((a) => a.level === 'warn'))
  checks.push(
    warned.length > 0
      ? {
          id: 'alerts',
          title: '위험 신호',
          status: 'warn',
          detail: `${warned.map((r) => `${r.name}(${r.alerts.find((a) => a.level === 'warn')!.title})`).join(', ')}에 주의 신호가 있습니다.`,
        }
      : { id: 'alerts', title: '위험 신호', status: 'good', detail: '보유 종목에 단기 급락이나 변동성 확대 신호가 없습니다.' },
  )

  // 4. 성향 대비 변동성(평가금액 가중 평균 순위)
  const allVol = [...metrics.values()].map((m) => m.vol)
  const volRank = rows.reduce((acc, r) => {
    const v = metrics.get(r.code)!.vol
    return acc + (allVol.filter((x) => x < v).length / (allVol.length - 1)) * r.weight
  }, 0)
  checks.push(
    volRank > VOL_LIMIT[risk]
      ? {
          id: 'vol',
          title: '성향 대비 변동성',
          status: 'warn',
          detail: `보유 종목의 변동성이 전체 종목 중 평균 ${plain(volRank, 0)} 위치로, ${RISK_LABEL[risk]} 기준보다 출렁임이 큰 편입니다.`,
        }
      : {
          id: 'vol',
          title: '성향 대비 변동성',
          status: 'good',
          detail: `보유 종목의 변동성이 전체 종목 중 평균 ${plain(volRank, 0)} 위치로, ${RISK_LABEL[risk]}에 맞는 수준입니다.`,
        },
  )

  // 5. 현금(정보)
  if (cash != null) {
    checks.push({
      id: 'cash',
      title: '투자 가능 현금',
      status: 'info',
      detail: `예수금 ${krw(cash)}이 있습니다. 계좌 전체의 ${plain(cash / (cash + total), 0)}입니다.`,
    })
  }

  return {
    rows,
    total,
    pnl,
    pnlRate: pnl != null ? pnl / cost : null,
    cash,
    sectors,
    checks,
    warnCount: checks.filter((c) => c.status === 'warn').length,
  }
}
