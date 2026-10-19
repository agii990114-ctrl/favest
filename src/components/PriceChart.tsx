import { useState, type KeyboardEvent, type PointerEvent } from 'react'
import { krw, signed } from '../lib/format'

interface Props {
  dates: string[]
  close: number[]
  volume: number[]
  label: string
}

const W = 600
const PRICE_H = 132
const GAP = 10
const VOL_H = 34
const H = PRICE_H + GAP + VOL_H

/** 차트 기간(거래일 수). 데이터가 일별 종가라 1일(분 단위) 차트는 두지 않는다. */
const PERIODS = [
  { key: '1w', label: '1주', days: 5 },
  { key: '1m', label: '1개월', days: 20 },
  { key: '3m', label: '3개월', days: 60 },
  { key: '6m', label: '6개월', days: 120 },
] as const
type PeriodKey = (typeof PERIODS)[number]['key']

/**
 * 가격선과 거래량 막대를 그리고, 기간을 고를 수 있다.
 * 마우스를 올리거나 누른 지점(키보드 화살표도 가능)의 날짜·종가·거래량을 보여 준다.
 */
export default function PriceChart({ dates: allDates, close: allClose, volume: allVolume, label }: Props) {
  const [period, setPeriod] = useState<PeriodKey>('6m')
  const [hover, setHover] = useState<number | null>(null)

  const days = PERIODS.find((p) => p.key === period)!.days
  const from = Math.max(0, allClose.length - 1 - days)
  const close = allClose.slice(from)
  const volume = allVolume.slice(from)
  const dates = allDates.slice(from)
  const n = close.length

  const min = Math.min(...close)
  const max = Math.max(...close)
  const span = max - min || 1
  const x = (i: number) => (i / (n - 1)) * W
  // 위쪽 28px은 기간 라벨 자리로 비워 둔다.
  const y = (v: number) => 28 + (1 - (v - min) / span) * (PRICE_H - 28 - 10)

  const line = close.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L${W},${PRICE_H} L0,${PRICE_H} Z`
  const periodRet = close[n - 1] / close[0] - 1
  const vmax = Math.max(...volume)
  const bw = W / n
  const label1 = PERIODS.find((p) => p.key === period)!.label

  function pick(e: PointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    setHover(Math.round(ratio * (n - 1)))
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const cur = hover ?? n - 1
      setHover(Math.min(n - 1, Math.max(0, cur + (e.key === 'ArrowRight' ? 1 : -1))))
    } else if (e.key === 'Escape') setHover(null)
  }

  const h = hover != null && hover < n ? hover : null
  const hLeft = h != null ? (h / (n - 1)) * 100 : 0
  const hChange = h != null ? close[h] / close[0] - 1 : 0

  return (
    <div className="chart">
      <div className="chart-top">
        <div className="seg" role="group" aria-label="차트 기간">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              aria-pressed={period === p.key}
              onClick={() => {
                setPeriod(p.key)
                setHover(null)
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div
        className="chart-plot"
        tabIndex={0}
        role="group"
        aria-label={`${label}. 좌우 화살표로 날짜별 가격을 볼 수 있습니다.`}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') setHover(null)
        }}
        onKeyDown={onKey}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <path d={area} fill="var(--ink)" opacity="0.06" />
          {volume.map((v, i) => (
            <rect
              key={i}
              x={i * bw + 0.6}
              width={Math.max(bw - 1.2, 0.5)}
              y={PRICE_H + GAP + (1 - v / vmax) * VOL_H}
              height={(v / vmax) * VOL_H}
              fill={i === h ? 'var(--ink)' : i >= n - 5 ? 'var(--pine)' : 'var(--rule-strong)'}
            />
          ))}
          <path d={line} fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {h != null && (
            <line x1={x(h)} x2={x(h)} y1={0} y2={H} stroke="var(--ink-2)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          )}
        </svg>

        <div className="chart-tag band num">
          최근 {label1}{' '}
          <b className={periodRet >= 0 ? 'up' : 'down'}>{signed(periodRet)}</b>
        </div>

        {h != null && (
          <>
            <span className="chart-dot" style={{ left: `${hLeft}%`, top: `${(y(close[h]) / H) * 100}%` }} aria-hidden="true" />
            <div
              className={`chart-tip num ${hLeft < 50 ? 'side-r' : 'side-l'}`}
              style={{ left: `${hLeft}%` }}
              role="status"
            >
              <span className="tip-date">{dates[h]}</span>
              <b>{krw(close[h])}</b>
              <span className={hChange >= 0 ? 'up' : 'down'}>기간 시작 대비 {signed(hChange)}</span>
              <span className="tip-vol">거래량 {volume[h].toLocaleString('ko-KR')}주</span>
            </div>
          </>
        )}
      </div>
      <div className="chart-axis num">
        <span>{dates[0]}</span>
        <span className="chart-legend">차트를 누르거나 마우스를 올리면 그날 가격이 보입니다</span>
        <span>{dates[n - 1]}</span>
      </div>
    </div>
  )
}
