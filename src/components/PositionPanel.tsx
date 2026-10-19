import type { Stock } from '../lib/types'
import { positionOf } from '../lib/position'
import { krw } from '../lib/format'

/** '지금 위치' 참고 신호: 최근 1주 흐름, 1개월 평균 대비, 3개월 범위 위치. */
export default function PositionPanel({ stock }: { stock: Stock }) {
  const p = positionOf(stock)
  return (
    <section className="position" aria-label="지금 위치 참고 신호">
      <h3>지금 위치</h3>
      <ul>
        {p.lines.map((l) => (
          <li key={l.key} className={l.tone}>
            <span className="pos-label">{l.label}</span>
            <span className="pos-text">{l.text}</span>
            {l.key === 'range' && (
              <span className="pos-range" aria-hidden="true">
                <span className="pos-track">
                  <i style={{ left: `${Math.round(p.rangePos * 100)}%` }} />
                </span>
                <span className="pos-ends num">
                  <span>{krw(p.low3m)}</span>
                  <span>{krw(p.high3m)}</span>
                </span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
