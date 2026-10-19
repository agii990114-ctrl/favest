import { useEffect, useRef, useState } from 'react'
import type { Horizon, Risk } from '../lib/types'
import { HORIZON_LABEL, RISK_LABEL, RISK_ORDER, krw } from '../lib/format'
import MoneyInput, { BudgetAddButtons } from './MoneyInput'

export interface ConditionValues {
  budget: number
  risk: Risk
  horizon: Horizon
  sectors: string[]
}

interface Props {
  values: ConditionValues
  sectors: Record<string, string>
  minBudget: number
  /** 연결된 계좌의 예수금(없으면 null) */
  cash?: number | null
  onChange: (patch: Partial<ConditionValues>) => void
  onRestart: () => void
  onClose: () => void
}


/** 조건 수정 팝업. 값을 바꾸는 즉시 onChange로 반영한다(따로 저장 버튼 없음). */
export default function ConditionsModal({ values, sectors, minBudget, cash, onChange, onRestart, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [budgetText, setBudgetText] = useState(String(values.budget))

  // 정리 단계에서 close()를 부르지 않는다(StrictMode에서 바로 닫히는 문제 방지).
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  const budgetNum = Number(budgetText)
  const budgetValid = Number.isFinite(budgetNum) && budgetNum >= minBudget

  function setBudget(text: string) {
    setBudgetText(text)
    const n = Number(text)
    if (Number.isFinite(n) && n >= minBudget) onChange({ budget: n })
  }

  function toggleSector(id: string) {
    const cur = values.sectors
    onChange({ sectors: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] })
  }

  return (
    <dialog
      ref={ref}
      className="stock-modal cond-modal"
      aria-labelledby="cond-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sm-body">
        <header className="sm-head">
          <div>
            <h2 id="cond-title">조건 수정</h2>
            <p className="muted">바꾸는 즉시 추천에 반영됩니다.</p>
          </div>
          <button className="sm-close" onClick={onClose} aria-label="닫기">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>

        <section className="cond-group">
          <div className="cond-head">
            <h3><label htmlFor="cond-budget">예산</label></h3>
            {cash != null && cash > 0 && (
              <button type="button" className="cash-btn" onClick={() => setBudget(String(cash))} title={`예수금 ${krw(cash)}을 예산으로 넣습니다`}>
                예수금 반영
              </button>
            )}
          </div>
          <MoneyInput id="cond-budget" value={budgetNum} onChange={(n) => setBudget(String(n))} />
          {!budgetValid && <p className="error">{krw(minBudget)} 이상 입력해 주십시오.</p>}
          <BudgetAddButtons value={budgetNum} onChange={(n) => setBudget(String(n))} />
        </section>

        <section className="cond-group">
          <h3>투자 성향</h3>
          <div className="row">
            {RISK_ORDER.map((r) => (
              <button key={r} className="pill" aria-pressed={values.risk === r} onClick={() => onChange({ risk: r })}>
                {RISK_LABEL[r]}
              </button>
            ))}
          </div>
        </section>

        <section className="cond-group">
          <h3>투자 기간</h3>
          <div className="row">
            {(['short', 'mid', 'long'] as Horizon[]).map((h) => (
              <button key={h} className="pill" aria-pressed={values.horizon === h} onClick={() => onChange({ horizon: h })}>
                {HORIZON_LABEL[h]}
              </button>
            ))}
          </div>
        </section>

        <section className="cond-group">
          <h3>관심 업종</h3>
          <div className="row">
            <button className="pill" aria-pressed={values.sectors.length === 0} onClick={() => onChange({ sectors: [] })}>
              전체
            </button>
            {Object.entries(sectors).map(([id, name]) => (
              <button key={id} className="pill" aria-pressed={values.sectors.includes(id)} onClick={() => toggleSector(id)}>
                {name}
              </button>
            ))}
          </div>
        </section>

        <div className="cond-foot">
          <button className="link" onClick={onRestart}>처음부터 다시 설정</button>
          <button className="btn primary" onClick={onClose} disabled={!budgetValid}>완료</button>
        </div>
      </div>
    </dialog>
  )
}
