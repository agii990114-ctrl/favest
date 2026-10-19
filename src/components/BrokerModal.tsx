import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dataset } from '../lib/types'
import { SaeumDemoBroker, summarizeAccount, type BrokerAccount } from '../lib/broker'
import { krw } from '../lib/format'
import Avatar from './Avatar'

interface Props {
  data: Dataset
  onConnected: (acc: BrokerAccount) => void
  onClose: () => void
}

/** 대시보드를 떠나지 않고 데모 계좌를 연결하는 팝업(동의 → 연결 → 결과 확인). */
export default function BrokerModal({ data, onConnected, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const [consent, setConsent] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [account, setAccount] = useState<BrokerAccount | null>(null)
  const summary = useMemo(() => (account ? summarizeAccount(account, data) : null), [account, data])

  // 정리 단계에서 close()를 부르지 않는다(StrictMode에서 바로 닫히는 문제 방지).
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  async function connect() {
    setConnecting(true)
    try {
      setAccount(await SaeumDemoBroker.fetchAccount(data))
    } finally {
      setConnecting(false)
    }
  }

  return (
    <dialog
      ref={ref}
      className="stock-modal cond-modal"
      aria-labelledby="broker-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sm-body">
        <header className="sm-head">
          <div>
            <h2 id="broker-title">증권사 계좌 연결 (데모)</h2>
            <p className="muted">가상의 새움증권 데모 계좌로만 연결되며, 실제 계좌에는 접속하지 않습니다.</p>
          </div>
          <button className="sm-close" onClick={onClose} aria-label="닫기">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>

        {!account && (
          <section className="cond-group">
            <h3>조회할 정보</h3>
            <ul className="broker-scope">
              <li>예수금(바로 투자할 수 있는 현금)</li>
              <li>보유 종목, 수량, 평균 매입가</li>
            </ul>
            <p className="muted">매매나 이체는 하지 않습니다.</p>
            <label className="check" style={{ marginTop: 12 }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>위 정보 조회에 동의합니다</span>
            </label>
            <button className="btn primary" disabled={!consent || connecting} onClick={connect}>
              {connecting ? '연결하는 중' : '계좌 연결하기'}
            </button>
          </section>
        )}

        {account && summary && (
          <section className="cond-group">
            <h3>{account.brokerName} 계좌가 연결되었습니다</h3>
            <p className="muted">계좌 {account.accountNo}, 기준일 {account.fetchedAt} 종가로 평가했습니다.</p>
            <dl className="acct">
              <div><dt>예수금</dt><dd className="num">{krw(account.cash)}</dd></div>
              <div><dt>주식 평가금액</dt><dd className="num">{krw(summary.totalValue)}</dd></div>
              <div>
                <dt>평가손익</dt>
                <dd className={`num ${summary.totalPnl >= 0 ? 'up' : 'down'}`}>
                  {summary.totalPnl >= 0 ? '+' : ''}{krw(summary.totalPnl)}
                </dd>
              </div>
            </dl>
            <ul className="wl">
              {summary.rows.map((r) => (
                <li key={r.code}>
                  <Avatar name={r.name} sector={r.sector} size="sm" />
                  <span className="nm">
                    {r.name}
                    <span className="sub num">{r.qty}주, 평균 {krw(r.avgPrice)}</span>
                  </span>
                  <span className="num">{krw(r.value)}</span>
                  <span className={`num ${r.pnlRate >= 0 ? 'up' : 'down'}`}>
                    {r.pnlRate >= 0 ? '+' : ''}{(r.pnlRate * 100).toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
            <div className="cond-foot" style={{ marginTop: 16 }}>
              <span className="muted">연결을 마치면 내 계좌 점검이 바로 나옵니다.</span>
              <button className="btn primary" onClick={() => onConnected(account)}>연결 완료</button>
            </div>
          </section>
        )}
      </div>
    </dialog>
  )
}
