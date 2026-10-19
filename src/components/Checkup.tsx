import type { Dataset } from '../lib/types'
import type { CheckupResult } from '../lib/checkup'
import { krw, plain, signed } from '../lib/format'
import { sectorColor } from '../lib/sectors'
import Avatar from './Avatar'
import type { SectorSuggestion } from '../lib/sectorPick'


interface Props {
  data: Dataset
  checkup: CheckupResult | null
  suggestions: SectorSuggestion[]
  onOpen: (code: string) => void
  onRecommend: () => void
  onConnect: () => void
}

/** 메인 화면: 내 계좌를 점검하고, 보완이 필요하면 추천으로 이어준다. */
export default function Checkup({ data, checkup, suggestions, onOpen, onRecommend, onConnect }: Props) {
  const sectorName = (id: string) => data.sectors[id] ?? id

  return (
    <div className="stack-gap checkup">
      {!checkup ? (
        <section className="panel empty-check">
          <h2>계좌를 연결하면 매일 점검해 드립니다</h2>
          <p className="muted">
            보유 종목의 업종 쏠림, 위험 신호, 성향 적합도를 확인하고 보완할 종목을 추천합니다. 증권사 계좌(데모)를 연결해 주십시오.
          </p>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn primary" onClick={onConnect}>계좌 연결하기</button>
            <button className="link" onClick={onRecommend}>추천만 보기</button>
          </div>
        </section>
      ) : (
        <>
          <section className="panel">
            <div className="panel-head">
              <h2>내 계좌 한눈에</h2>
              <span className="muted">기준일 {data.asOf}</span>
            </div>
            <dl className="acct">
              <div><dt>주식 평가금액</dt><dd className="num">{krw(checkup.total)}</dd></div>
              {checkup.pnl != null && checkup.pnlRate != null && (
                <div>
                  <dt>평가손익</dt>
                  <dd className={`num ${checkup.pnl >= 0 ? 'up' : 'down'}`}>
                    {checkup.pnl >= 0 ? '+' : ''}{krw(checkup.pnl)} ({signed(checkup.pnlRate)})
                  </dd>
                </div>
              )}
              {checkup.cash != null && <div><dt>예수금</dt><dd className="num">{krw(checkup.cash)}</dd></div>}
            </dl>
          </section>

          <section className="panel" aria-labelledby="holdings-title">
            <div className="panel-head">
              <h2 id="holdings-title">보유 종목 {checkup.rows.length}개</h2>
            </div>
            <ul className="wl">
              {checkup.rows.map((r) => (
                <li key={r.code}>
                  <Avatar name={r.name} sector={r.sector} size="sm" />
                  <button className="nm row-open" onClick={() => onOpen(r.code)} aria-label={`${r.name} 상세 보기`}>
                    {r.name}
                    <span className="sub num">
                      {r.qty}주, 비중 {plain(r.weight, 0)}{r.avgPrice ? `, 평균 ${krw(r.avgPrice)}` : ''}
                    </span>
                  </button>
                  <span className="num">{krw(r.value)}</span>
                  {r.pnlRate != null ? (
                    <span className={`num ${r.pnlRate >= 0 ? 'up' : 'down'}`}>{signed(r.pnlRate)}</span>
                  ) : (
                    <span className={`num ${r.ret20 >= 0 ? 'up' : 'down'}`}>1개월 {signed(r.ret20)}</span>
                  )}
                  {r.alerts.length > 0 && (
                    <span className="flag">{r.alerts[0].title}: {r.alerts[0].detail}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="panel" aria-labelledby="sector-title">
            <div className="panel-head">
              <h2 id="sector-title">업종 비중</h2>
            </div>
            <div className="bar" role="img" aria-label="업종별 비중">
              {checkup.sectors.map((s) => (
                <span key={s.id} style={{ width: `${s.share * 100}%`, background: sectorColor(s.id)[1] }} />
              ))}
            </div>
            <ul className="alloc">
              {checkup.sectors.map((s) => (
                <li key={s.id}>
                  <i style={{ background: sectorColor(s.id)[1] }} />
                  <span>{sectorName(s.id)}</span>
                  <span className="num muted">{krw(s.value)}</span>
                  <span className="num">{plain(s.share, 0)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="next-step">
            <div>
              <h2>{checkup.warnCount > 0 ? '보완할 종목을 골라 봤습니다' : '남은 돈을 나눠 담을 종목을 골라 봤습니다'}</h2>
              <p className="muted">보유 종목은 빼고, 비중이 낮은 업종에 가산점을 줘서 고른 결과입니다. 추천 업종은 종합 점수 상위 종목이 많이 모인 업종 중 보유 비중이 10% 미만인 곳입니다.</p>
              {suggestions.length > 0 && (
                <div className="sug">
                  <span className="sug-label">추천 업종</span>
                  {suggestions.map((s) => (
                    <span key={s.id} className="sug-chip" title={s.reason}>
                      <i style={{ background: sectorColor(s.id)[1] }} />
                      {sectorName(s.id)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button className="btn primary" onClick={onRecommend}>보완 종목 추천 보기</button>
          </section>
        </>
      )}
    </div>
  )
}
