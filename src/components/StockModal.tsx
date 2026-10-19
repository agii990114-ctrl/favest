import { useEffect, useRef } from 'react'
import type { Alert, Metrics, Stock } from '../lib/types'
import { krw, plain, signed } from '../lib/format'
import PriceChart from './PriceChart'
import NewsPanel from './NewsPanel'
import Avatar from './Avatar'
import PositionPanel from './PositionPanel'

interface Props {
  stock: Stock
  metrics: Metrics
  sectorName: string
  alerts: Alert[]
  watched: boolean
  onToggleWatch: () => void
  onClose: () => void
}

/** 종목 상세 팝업. 네이티브 dialog를 써서 포커스 가두기와 Esc 닫기를 브라우저에 맡긴다. */
export default function StockModal({ stock, metrics: m, sectorName, alerts, watched, onToggleWatch, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  // 정리 단계에서 close()를 부르면 close 이벤트로 onClose가 다시 불려 개발 모드(StrictMode)에서 바로 닫히므로 부르지 않는다.
  // 컴포넌트가 사라지면 dialog도 DOM에서 빠지면서 함께 정리된다.
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  const rets: [string, number][] = [
    ['1일', m.ret1],
    ['1주', m.ret5],
    ['1개월', m.ret20],
    ['3개월', m.ret60],
    ['6개월', m.ret120],
  ]

  return (
    <dialog
      ref={ref}
      className="stock-modal"
      aria-labelledby="stock-modal-title"
      onClose={onClose}
      onClick={(e) => {
        // 바깥(배경)을 누르면 닫는다
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sm-body">
        <header className="sm-head">
          <div className="hero-title">
            <Avatar name={stock.name} sector={stock.sector} size="lg" />
            <div>
              <h2 id="stock-modal-title">{stock.name}</h2>
              <p className="muted">
                {sectorName}, 종목코드 <span className="num">{stock.code}</span>
              </p>
            </div>
          </div>
          <div className="sm-actions">
            <button className="star" aria-pressed={watched} onClick={onToggleWatch} aria-label={watched ? '관심 종목에서 빼기' : '관심 종목에 담기'}>
              {watched ? '★ 관심' : '☆ 관심'}
            </button>
            <button className="sm-close" onClick={onClose} aria-label="닫기">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        </header>

        <div className="price-line">
          <span className="price num">{krw(m.price)}</span>
          <span className={`num ${m.ret1 >= 0 ? 'up' : 'down'}`}>{signed(m.ret1)}</span>
          <span className="muted">기준일 하루 등락</span>
        </div>

        <PriceChart dates={stock.dates} close={stock.close} volume={stock.volume} label={`${stock.name} 최근 6개월 가격과 거래량`} />

        <dl className="sm-rets">
          {rets.map(([label, v]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className={`num ${v >= 0 ? 'up' : 'down'}`}>{signed(v)}</dd>
            </div>
          ))}
          <div>
            <dt>거래량</dt>
            <dd className="num">{m.volRatio.toFixed(1)}배</dd>
          </div>
          <div>
            <dt>일간 변동성</dt>
            <dd className="num">{plain(m.vol, 2)}</dd>
          </div>
        </dl>
        <p className="muted sm-note">거래량은 최근 1주 평균을 3개월 평균과 비교한 값입니다.</p>

        <PositionPanel stock={stock} />

        {alerts.length > 0 && (
          <ul className="sm-alerts">
            {alerts.map((a) => (
              <li key={a.title} className={a.level}>
                <b>{a.title}</b> {a.detail}
              </li>
            ))}
          </ul>
        )}


        <NewsPanel name={stock.name} />
      </div>
    </dialog>
  )
}
