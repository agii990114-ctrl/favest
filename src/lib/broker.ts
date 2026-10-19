import type { Dataset, Risk } from './types'
import { computeMetrics, riskFromRank } from './engine'

/**
 * 증권사 계좌 연결 계층.
 * 앱은 증권사마다 다른 API 응답을 직접 쓰지 않고, 어댑터가 아래 표준 형식(BrokerAccount)으로 바꿔 준다.
 * 지금은 데모 어댑터만 있다. 실제 연동 시에는 서버리스 함수에서 증권사 토큰을 발급받아
 * 잔고를 조회한 뒤 같은 형식으로 변환하는 어댑터(예: 한국투자증권 오픈 API)를 추가한다.
 * 토큰과 앱 키는 브라우저에 두지 않는다.
 */
export interface Position {
  code: string
  name: string
  sector: string
  qty: number
  avgPrice: number
}

export interface BrokerAccount {
  brokerName: string
  accountNo: string
  cash: number
  positions: Position[]
  fetchedAt: string
}

export interface BrokerAdapter {
  id: string
  name: string
  demo: boolean
  fetchAccount(data: Dataset): Promise<BrokerAccount>
}

/** 평균 매입가는 데이터 첫날 종가에 배수를 곱해 현실적인 범위로 만든다. */
const DEMO_POSITIONS = [
  { code: '005930', qty: 15, costRatio: 0.92 },
  { code: '105560', qty: 13, costRatio: 1.04 },
  { code: '005380', qty: 5, costRatio: 1.08 },
  { code: '035420', qty: 2, costRatio: 0.97 },
]

/** 가상의 '새움증권' 데모 계좌. 실제 계좌에 접속하지 않는다. */
export const SaeumDemoBroker: BrokerAdapter = {
  id: 'saeum-demo',
  name: '새움증권',
  demo: true,
  async fetchAccount(data) {
    await new Promise((r) => setTimeout(r, 900))
    const byCode = new Map(data.stocks.map((s) => [s.code, s]))
    return {
      brokerName: '새움증권',
      accountNo: '***-**-1234',
      cash: 2_500_000,
      positions: DEMO_POSITIONS.filter((p) => byCode.has(p.code)).map((p) => {
        const s = byCode.get(p.code)!
        const base = s.close[Math.max(0, s.close.length - 61)] // 약 3개월 전 종가 기준
        const avgPrice = Math.round((base * p.costRatio) / 100) * 100
        return { code: p.code, qty: p.qty, avgPrice, name: s.name, sector: s.sector }
      }),
      fetchedAt: data.asOf,
    }
  },
}

export const BROKERS: BrokerAdapter[] = [SaeumDemoBroker]

export interface AccountSummary {
  rows: (Position & { price: number; value: number; pnl: number; pnlRate: number })[]
  totalValue: number
  totalPnl: number
  inferredRisk: Risk
  basis: string
}

/** 보유 종목을 기준일 종가로 평가하고, 보유 종목의 변동성 위치로 성향을 추정한다. */
export function summarizeAccount(acc: BrokerAccount, data: Dataset): AccountSummary {
  const metrics = new Map(data.stocks.map((s) => [s.code, computeMetrics(s)]))
  const rows = acc.positions.map((p) => {
    const price = metrics.get(p.code)?.price ?? p.avgPrice
    const value = price * p.qty
    const pnl = (price - p.avgPrice) * p.qty
    return { ...p, price, value, pnl, pnlRate: price / p.avgPrice - 1 }
  })
  const totalValue = rows.reduce((s, r) => s + r.value, 0)
  const totalPnl = rows.reduce((s, r) => s + r.pnl, 0)

  const allVol = [...metrics.values()].map((m) => m.vol)
  const ranks = rows.map((r) => {
    const v = metrics.get(r.code)?.vol ?? 0
    return allVol.filter((x) => x < v).length / (allVol.length - 1)
  })
  const avgRank = ranks.length ? ranks.reduce((s, v) => s + v, 0) / ranks.length : 0.5
  const inferredRisk: Risk = riskFromRank(avgRank)

  return {
    rows,
    totalValue,
    totalPnl,
    inferredRisk,
    basis: `보유 종목의 변동성이 전체 종목 중 평균 ${(avgRank * 100).toFixed(0)}% 위치입니다.`,
  }
}
