export const krw = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`

export const signed = (ratio: number, digits = 1) => {
  const v = ratio * 100
  return `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`
}

export const plain = (ratio: number, digits = 1) => `${(ratio * 100).toFixed(digits)}%`

export const RISK_LABEL = {
  stable: '안정형',
  stablePlus: '안정추구형',
  neutral: '위험중립형',
  active: '적극투자형',
  aggressive: '공격투자형',
} as const
export const RISK_ORDER = ['stable', 'stablePlus', 'neutral', 'active', 'aggressive'] as const
export const HORIZON_LABEL = { short: '단기', mid: '중기', long: '장기' } as const
