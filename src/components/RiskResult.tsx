import type { Risk } from '../lib/types'
import { RISK_LABEL, RISK_ORDER } from '../lib/format'
import { GRADE_LABEL, RISK_INFO, STOCK_GRADE, stockSuitable } from '../lib/quiz'

interface Props {
  name: string
  risk: Risk
  basis?: string
  /** 진단 결과와 다른 성향을 사용자가 고른 경우 */
  overridden?: boolean
  onPick: (r: Risk) => void
}

/** 투자성향 진단 결과: 5단계 중 위치, 성향 설명, 권유 가능한 상품 위험등급, 주식 적합 여부. */
export default function RiskResult({ name, risk, basis, overridden, onPick }: Props) {
  const info = RISK_INFO[risk]
  return (
    <section className="risk-result" aria-labelledby="risk-title">
      <h3 id="risk-title">
        {name} 님의 투자성향은 <em>{RISK_LABEL[risk]}</em>입니다
      </h3>

      <div className="risk-steps" role="group" aria-label="투자성향 5단계 중 선택">
        {RISK_ORDER.map((r) => (
          <button key={r} aria-pressed={r === risk} onClick={() => onPick(r)}>
            {RISK_LABEL[r]}
          </button>
        ))}
      </div>
      <p className="risk-desc">{info.desc}</p>
      {basis && <p className="muted">{basis}</p>}
      {overridden && <p className="muted">진단 결과 대신 직접 고른 성향으로 추천합니다.</p>}
      <p className="muted" style={{ marginTop: 4 }}>단계를 눌러 성향을 직접 바꿀 수 있습니다.</p>

      <h4>권유 가능한 상품 위험등급</h4>
      <div className="grade-bar" aria-label={`${GRADE_LABEL[info.maxGrade - 1]} 이하 상품 권유 가능`}>
        {GRADE_LABEL.map((g, i) => {
          const grade = i + 1
          return (
            <span key={g} className={grade >= info.maxGrade ? 'ok' : ''}>
              {g}
              <small>{grade}등급</small>
            </span>
          )
        })}
      </div>
      <p className="muted">
        {RISK_LABEL[risk]}은 {GRADE_LABEL[info.maxGrade - 1]}({info.maxGrade}등급) 이하 상품이 적합합니다. 등급 기준은 과제용 예시이며 증권사마다 다를 수 있습니다.
      </p>
      {!stockSuitable(risk) && (
        <p className="risk-warn">
          개별 주식은 {GRADE_LABEL[STOCK_GRADE - 1]}({STOCK_GRADE}등급) 이상 상품으로, {RISK_LABEL[risk]}에게는 투자성향보다 위험한 상품입니다. 추천은 참고용으로 보여 드리며, 투자 전 이 점을 확인하십시오.
        </p>
      )}
    </section>
  )
}
