import type { Stock } from './types'
import { plain, signed } from './format'

/**
 * 지금 가격이 최근 흐름에서 어디쯤인지 보여 주는 참고 신호.
 * 매수·매도 시점 판단이 아니라 현재 상태를 서술만 한다. 기준값은 과제용 가정이다.
 */
export interface PositionInfo {
  ret5: number
  maGap: number
  rangePos: number
  low3m: number
  high3m: number
  lines: { key: 'trend' | 'ma' | 'range'; label: string; text: string; tone: 'hot' | 'cold' | 'flat' }[]
}

/** 1주 흐름 구간(과제용 가정): +10% 이상, +4% 이상, -4% 이하, -7% 이하 */
const UP_BIG = 0.1
const UP = 0.04
const DOWN = -0.04
const DOWN_BIG = -0.07

export function positionOf(s: Stock): PositionInfo {
  const c = s.close
  const n = c.length
  const price = c[n - 1]
  const ret5 = price / c[Math.max(0, n - 6)] - 1
  // 1개월 평균 = 최근 20거래일 종가 평균
  const ma20 = c.slice(-20).reduce((a, v) => a + v, 0) / Math.min(20, n)
  const maGap = price / ma20 - 1
  const w = c.slice(-61)
  const low3m = Math.min(...w)
  const high3m = Math.max(...w)
  const rangePos = high3m > low3m ? (price - low3m) / (high3m - low3m) : 0.5

  // 화면에 보이는 값(소수 첫째 자리)과 판정이 어긋나지 않도록 반올림한 값으로 판정한다.
  const r5 = Math.round(ret5 * 1000) / 1000
  const trend =
    r5 >= UP_BIG
      ? { text: `최근 1주 ${signed(ret5)}로 단기간에 많이 오른 상태입니다.`, tone: 'hot' as const }
      : r5 >= UP
        ? { text: `최근 1주 ${signed(ret5)}로 오른 편입니다.`, tone: 'hot' as const }
        : r5 <= DOWN_BIG
          ? { text: `최근 1주 ${signed(ret5)}로 단기간에 많이 내린 상태입니다.`, tone: 'cold' as const }
          : r5 <= DOWN
            ? { text: `최근 1주 ${signed(ret5)}로 내린 편입니다.`, tone: 'cold' as const }
            : { text: `최근 1주 등락은 ${signed(ret5)}로 큰 변동이 없습니다.`, tone: 'flat' as const }

  const ma =
    Math.abs(maGap) < 0.01
      ? { text: '현재가가 최근 1개월 평균과 거의 같습니다.', tone: 'flat' as const }
      : { text: `현재가가 최근 1개월 평균보다 ${plain(Math.abs(maGap), 1)} ${maGap > 0 ? '높습니다' : '낮습니다'}.`, tone: maGap > 0 ? ('hot' as const) : ('cold' as const) }

  const pct = Math.round(rangePos * 100)
  const range = {
    text: `최근 3개월 가격 범위에서 ${pct}% 지점입니다(최저 0%, 최고 100%).`,
    tone: pct >= 80 ? ('hot' as const) : pct <= 20 ? ('cold' as const) : ('flat' as const),
  }

  return {
    ret5,
    maGap,
    rangePos,
    low3m,
    high3m,
    lines: [
      { key: 'trend', label: '최근 1주 흐름', ...trend },
      { key: 'ma', label: '1개월 평균 대비', ...ma },
      { key: 'range', label: '3개월 범위 위치', ...range },
    ],
  }
}
