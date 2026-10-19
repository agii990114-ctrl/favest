/** 투자성향 5단계: 안정형, 안정추구형, 위험중립형, 적극투자형, 공격투자형 */
export type Risk = 'stable' | 'stablePlus' | 'neutral' | 'active' | 'aggressive'
export type Horizon = 'short' | 'mid' | 'long'
/** ret20=1개월(20거래일, 점수에는 넣지 않는 참고 요인), ret60=3개월·ret120=6개월 모멘텀(최근 1개월 제외 수익률) */
export type FactorKey = 'ret20' | 'ret60' | 'ret120' | 'volRatio' | 'stability'

export interface Stock {
  code: string
  name: string
  sector: string
  dates: string[]
  close: number[]
  volume: number[]
}

export interface Dataset {
  asOf: string
  source: string
  sectors: Record<string, string>
  stocks: Stock[]
}

export interface Profile {
  budget: number
  risk: Risk
  horizon: Horizon
  sectors: string[]
  holdings: string[]
}

export interface Metrics {
  price: number
  ret1: number
  ret5: number
  ret20: number
  ret60: number
  ret120: number
  volRatio: number
  vol: number
  recentVol: number
  drawdown: number
  maxDrawdown: number
  /** 최근 1개월을 뺀 3개월 수익률(20일 전 가격 ÷ 60일 전 가격 − 1) */
  mom60: number
  /** 최근 1개월을 뺀 6개월 수익률(20일 전 가격 ÷ 120일 전 가격 − 1) */
  mom120: number
}

export interface Pick {
  stock: Stock
  metrics: Metrics
  score: number
  pct: Record<FactorKey, number>
  contrib: Record<FactorKey, number>
  weight: number
  shares: number
  cost: number
  reasons: string[]
  cautions: string[]
}

export interface RecommendResult {
  picks: Pick[]
  invested: number
  cash: number
  weights: Record<FactorKey, number>
  excluded: Record<string, number>
  notices: string[]
  /** 고른 업종의 후보가 모자라 다른 업종으로 채웠을 때의 안내 */
  sectorNote?: string
  candidateCount: number
}

export interface Alert {
  code: string
  name: string
  level: 'warn' | 'info'
  title: string
  detail: string
}
