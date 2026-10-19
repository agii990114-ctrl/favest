/** 금액 입력칸. 입력하는 동안에도 3,000,000처럼 쉼표를 찍어 보여 주고, 숫자만 값으로 넘긴다. */
export default function MoneyInput({
  id,
  value,
  onChange,
  className,
  label,
}: {
  id?: string
  value: number
  onChange: (n: number) => void
  className?: string
  label?: string
}) {
  return (
    <span className="money-input">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        className={className}
        aria-label={label}
        value={Number.isFinite(value) && value > 0 ? value.toLocaleString('ko-KR') : ''}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d]/g, '').slice(0, 13)
          onChange(digits ? Number(digits) : 0)
        }}
      />
      <span className="money-unit">원</span>
    </span>
  )
}

const ADD_STEPS = [100_000, 500_000, 1_000_000, 5_000_000, 10_000_000]

/** 누른 금액만큼 현재 예산에 더해 주는 버튼들(덮어쓰지 않고 합산). */
export function BudgetAddButtons({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const base = Number.isFinite(value) && value > 0 ? value : 0
  return (
    <div className="row add-row" role="group" aria-label="예산 더하기">
      {ADD_STEPS.map((v) => (
        <button key={v} type="button" className="pill add-pill" onClick={() => onChange(Math.min(base + v, 9_999_999_999_999))}>
          +{v / 10_000}만원
        </button>
      ))}
      <button type="button" className="link add-reset" onClick={() => onChange(0)} disabled={base === 0}>
        지우기
      </button>
    </div>
  )
}
