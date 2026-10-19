import { useEffect, useRef } from 'react'
import { sectorColor } from '../lib/sectors'

interface Props {
  suggested: string[]
  current: string[]
  sectorName: (id: string) => string
  onAccept: () => void
  onKeep: () => void
  onClose: () => void
}

/** 보완 종목을 보기 전에, 관심 업종을 추천 업종으로 바꿀지 묻는다. */
export default function SectorSwitchModal({ suggested, current, sectorName, onAccept, onKeep, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  // 정리 단계에서 close()를 부르지 않는다(StrictMode에서 바로 닫히는 문제 방지).
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  const chips = (ids: string[]) =>
    ids.length === 0 ? (
      <span className="sug-chip">전체 업종</span>
    ) : (
      ids.map((id) => (
        <span key={id} className="sug-chip">
          <i style={{ background: sectorColor(id)[1] }} />
          {sectorName(id)}
        </span>
      ))
    )

  return (
    <dialog
      ref={ref}
      className="stock-modal cond-modal"
      aria-labelledby="switch-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sm-body">
        <header className="sm-head">
          <div>
            <h2 id="switch-title">추천 업종으로 찾아보시겠습니까?</h2>
            <p className="muted">관심 업종을 보유 비중이 낮은 추천 업종으로 바꿔 보완 종목을 다시 찾습니다.</p>
          </div>
          <button className="sm-close" onClick={onClose} aria-label="닫기">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>

        <section className="cond-group">
          <h3>지금 관심 업종</h3>
          <div className="sug">{chips(current)}</div>
        </section>
        <section className="cond-group">
          <h3>바꿀 업종(추천)</h3>
          <div className="sug switch-to">{chips(suggested)}</div>
        </section>

        <div className="cond-foot">
          <button className="link" onClick={onKeep}>지금 조건 그대로 보기</button>
          <button className="btn primary" onClick={onAccept}>추천 업종으로 찾기</button>
        </div>
      </div>
    </dialog>
  )
}
