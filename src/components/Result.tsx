import { Fragment, useEffect, useRef, useMemo, useState, type ReactNode } from 'react'
import type { Alert, Dataset, FactorKey, Metrics, Pick, Profile, RecommendResult, Stock } from '../lib/types'
import { ALERT_PERIODS, checkAlerts, periodAlerts, type AlertPeriodKey } from '../lib/alerts'
import { computeMetrics } from '../lib/engine'
import { HORIZON_LABEL, RISK_LABEL, krw, plain, signed } from '../lib/format'
import { loadWatch, saveWatch } from '../lib/watch'
import PriceChart from './PriceChart'
import NewsPanel from './NewsPanel'
import Avatar from './Avatar'
import { sectorColor } from '../lib/sectors'
import type { Holding } from '../lib/auth'
import Checkup from './Checkup'
import StockModal from './StockModal'
import PositionPanel from './PositionPanel'
import ConditionsModal, { type ConditionValues } from './ConditionsModal'
import BrokerModal from './BrokerModal'
import SectorSwitchModal from './SectorSwitchModal'
import type { BrokerAccount } from '../lib/broker'
import { runCheckup } from '../lib/checkup'
import { stockSuitable } from '../lib/quiz'
import { suggestSectors } from '../lib/sectorPick'

const COLORS = ['#3550e0', '#f0a500', '#8b3fd9', '#e0482a', '#00866a']

type Tab = 'account' | 'recommend' | 'explore' | 'watch'

interface Props {
  data: Dataset
  profile: Profile
  result: RecommendResult
  portfolio: Holding[]
  /** 계좌 연결로 알게 된 예수금 */
  cash: number | null
  /** 처음 열 탭 */
  initialTab?: Tab
  /** 계좌 연결 팝업에서 연결을 마쳤을 때 */
  onAccountConnected: (acc: BrokerAccount) => void
  userEmail: string
  onRestart: () => void
  onBack: () => void
  /** 조건 수정 팝업에서 바꾼 값을 즉시 반영 */
  onChangeConditions: (patch: Partial<ConditionValues>) => void
  minBudget: number
}

/** 이유 문장 속 근거 숫자에 형광펜을 칠한다. */
const NUM = /([+-]?\d+(?:\.\d+)?%|\d+(?:\.\d+)?배|상위 \d+%)/
function Marked({ text }: { text: string }) {
  return (
    <>
      {text.split(NUM).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : <Fragment key={i}>{part}</Fragment>))}
    </>
  )
}

/** 점수에 가장 크게 기여한 지표를 짧은 태그로 보여준다(과거 수치 서술만 사용). */
function tagsOf(p: Pick): string[] {
  const top = (Object.keys(p.contrib) as FactorKey[]).sort((a, b) => p.contrib[b] - p.contrib[a]).slice(0, 2)
  return top.map((k) => {
    if (k === 'ret20') return p.metrics.ret20 >= 0 ? '1개월 상승' : '1개월 낙폭 작음'
    if (k === 'ret60') return p.metrics.mom60 >= 0 ? '3개월 추세 상승' : '3개월 추세 낙폭 작음'
    if (k === 'ret120') return p.metrics.mom120 >= 0 ? '6개월 추세 상승' : '6개월 추세 낙폭 작음'
    if (k === 'volRatio') return p.metrics.volRatio >= 1 ? '거래량 증가' : '거래량 꾸준'
    return '변동성 낮음'
  })
}

export default function Result({
  data,
  profile,
  result,
  portfolio,
  cash,
  initialTab,
  onAccountConnected,
  userEmail,
  onRestart,
  onChangeConditions,
  minBudget,
}: Props) {
  const [condOpen, setCondOpen] = useState(false)
  const [brokerOpen, setBrokerOpen] = useState(false)
  const [switchOpen, setSwitchOpen] = useState(false)
  const { picks } = result
  const [tab, setTab] = useState<Tab>(initialTab ?? 'recommend')
  const checkup = useMemo(() => runCheckup(data, portfolio, profile.risk, cash), [data, portfolio, profile.risk, cash])
  const sectorSuggestions = useMemo(
    () => suggestSectors(data, portfolio, profile.risk, profile.horizon),
    [data, portfolio, profile.risk, profile.horizon],
  )
  const [sel, setSel] = useState(0)
  const [watch, setWatch] = useState<string[]>(() => loadWatch(userEmail))
  const [detailCode, setDetailCode] = useState<string | null>(null)

  const metrics = useMemo(() => new Map(data.stocks.map((s) => [s.code, computeMetrics(s)])), [data])
  const byCode = useMemo(() => new Map(data.stocks.map((s) => [s.code, s])), [data])
  const sectorName = (id: string) => data.sectors[id] ?? id

  function toggleWatch(code: string) {
    setWatch((cur) => {
      const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]
      saveWatch(userEmail, next)
      return next
    })
  }

  const alertStocks = useMemo(() => {
    const codes = new Set([...picks.map((p) => p.stock.code), ...profile.holdings, ...watch])
    return data.stocks.filter((s) => codes.has(s.code))
  }, [data, picks, profile.holdings, watch])
  const alerts = useMemo(() => checkAlerts(alertStocks), [alertStocks])
  const alertGroups = useMemo(() => groupAlerts(alerts), [alerts])
  const alertByCode = useMemo(() => new Map(alertGroups.map((g) => [g.code, g])), [alertGroups])

  function goRecommend() {
    setTab('recommend')
    window.scrollTo(0, 0)
  }
  function openRecommend() {
    const sug = sectorSuggestions.map((x) => x.id)
    const same = sug.length === profile.sectors.length && sug.every((id) => profile.sectors.includes(id))
    if (sug.length === 0 || same) goRecommend()
    else setSwitchOpen(true)
  }

  const current = picks[Math.min(sel, picks.length - 1)]

  const watchPanel = (
    <section className="panel" aria-labelledby="wl-title">
      <div className="panel-head">
        <h2 id="wl-title">관심 종목</h2>
        {watch.length > 0 && (
          <button className="link" onClick={() => setTab('watch')}>모두 보기</button>
        )}
      </div>
      {watch.length === 0 ? (
        <p className="wl-empty">종목 카드의 ☆ 버튼으로 관심 종목에 담아 두면 주의가 필요할 때 여기에 표시됩니다.</p>
      ) : (
        <ul className="wl">
          {watch.slice(0, 5).map((code) => (
            <WatchRow
              key={code}
              stock={byCode.get(code)}
              m={metrics.get(code)}
              flag={alertByCode.get(code)}
              onOpen={() => setDetailCode(code)}
            />
          ))}
        </ul>
      )}
    </section>
  )

  const holdPanel = checkup && checkup.rows.length > 0 && (
    <section className="panel" aria-labelledby="hold-title">
      <div className="panel-head">
        <h2 id="hold-title">보유 종목</h2>
        <button className="link" onClick={() => setTab('account')}>모두 보기</button>
      </div>
      <ul className="wl">
        {checkup.rows.map((r) => (
          <li key={r.code}>
            <Avatar name={r.name} sector={r.sector} size="sm" />
            <button className="nm row-open" onClick={() => setDetailCode(r.code)} aria-label={`${r.name} 상세 보기`}>
              {r.name}
              <span className="sub num">{r.qty}주, 비중 {plain(r.weight, 0)}</span>
            </button>
            {r.pnlRate != null ? (
              <span className={`num ${r.pnlRate >= 0 ? 'up' : 'down'}`}>{signed(r.pnlRate)}</span>
            ) : (
              <span className={`num ${r.ret20 >= 0 ? 'up' : 'down'}`}>{signed(r.ret20)}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )

  return (
    <div>
      <div className="top-band">
        <nav className="topnav" role="tablist" aria-label="화면 선택">
          {([
            ['account', '내 계좌'],
            ['recommend', '추천'],
            ['explore', '종목 탐색'],
            ['watch', `관심 종목${watch.length ? ` ${watch.length}` : ''}`],
          ] as [Tab, string][]).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>

        <div className="condbar">
          <span className="chip num">예산 {krw(profile.budget)}</span>
          <span className="chip">{RISK_LABEL[profile.risk]}</span>
          <span className="chip">{HORIZON_LABEL[profile.horizon]}</span>
          <span className="chip">{profile.sectors.length ? profile.sectors.map(sectorName).join(', ') : '전체 업종'}</span>
          <button className="link" onClick={() => setCondOpen(true)}>조건 수정</button>
        </div>
      </div>

      {tab === 'account' && (
        <div className="dash">
          <Checkup
            data={data}
            checkup={checkup}
            suggestions={sectorSuggestions}
            onOpen={setDetailCode}
            onRecommend={openRecommend}
            onConnect={() => setBrokerOpen(true)}
          />
          <aside className="side">{watchPanel}</aside>
        </div>
      )}

      {tab === 'recommend' && (
        <div className="dash">
          <div className="stack-gap">
            {!stockSuitable(profile.risk) && (
              <p className="risk-warn">
                {profile.risk === 'stable' || profile.risk === 'stablePlus'
                  ? `${RISK_LABEL[profile.risk]} 기준으로 변동성이 낮고 최근 낙폭이 작은 종목만 추렸고, 종목 수를 늘려 비중을 나눴습니다. 그래도 주식은 원금 손실이 날 수 있는 상품이니 투자 전 확인하십시오.`
                  : `주식은 원금 손실이 날 수 있는 상품입니다. ${RISK_LABEL[profile.risk]} 기준의 추천은 참고용이니 투자 전 확인하십시오.`}
              </p>
            )}

            {result.sectorNote && <p className="sector-note">{result.sectorNote}</p>}

            {picks.length === 0 && (
              <section className="panel">
                <p>조건에 맞는 종목을 찾지 못했습니다. 예산을 늘리거나 관심 분야를 바꿔 보십시오.</p>
              </section>
            )}

            {picks.length > 0 && (
              <>
                <MiniSlider>
                  {picks.map((p, i) => (
                    <button key={p.stock.code} className="mini" aria-pressed={i === sel} onClick={() => setSel(i)}>
                      <div className="mini-top">
                        <Avatar name={p.stock.name} sector={p.stock.sector} />
                        <span className="rk">{i + 1}순위</span>
                      </div>
                      <b className="mini-name">{p.stock.name}</b>
                      <div className="mini-price num">
                        <span className="mini-won">{krw(p.metrics.price)}</span>
                        <span className={`mini-chg ${p.metrics.ret20 >= 0 ? 'up' : 'down'}`}>1개월 {signed(p.metrics.ret20)}</span>
                      </div>
                      <div className="tags">
                        {tagsOf(p).map((t) => <span key={t} className="tag">{t}</span>)}
                      </div>
                    </button>
                  ))}
                </MiniSlider>

                <article className="panel hero" aria-live="polite">
                  <div className="hero-head">
                    <div>
                      <div className="hero-title">
                        <Avatar name={current.stock.name} sector={current.stock.sector} size="lg" />
                        <div>
                          <span className="rank-pill">{sel + 1}순위</span>
                          <h2>{current.stock.name}</h2>
                        </div>
                      </div>
                      <div className="price-line">
                        <span className="price num">{krw(current.metrics.price)}</span>
                        <span className={`num ${current.metrics.ret1 >= 0 ? 'up' : 'down'}`}>{signed(current.metrics.ret1)}</span>
                        <span className="muted">기준일 하루 등락</span>
                      </div>
                      <dl className="facts">
                        <div><dt>업종</dt><dd>{sectorName(current.stock.sector)}</dd></div>
                        <div><dt>종목코드</dt><dd className="num">{current.stock.code}</dd></div>
                        <div><dt>종합 점수</dt><dd className="num">{current.score.toFixed(1)}</dd></div>
                      </dl>
                    </div>
                    <div className="hero-actions">
                      <div className="hero-buy">
                        <b className="num">{current.shares}주</b>
                        <span className="num">{krw(current.cost)}</span>
                      </div>
                    </div>
                    <div className="card-star">
                      <StarButton on={watch.includes(current.stock.code)} onClick={() => toggleWatch(current.stock.code)} />
                    </div>
                  </div>

                  <PriceChart
                    dates={current.stock.dates}
                    close={current.stock.close}
                    volume={current.stock.volume}
                    label={`${current.stock.name} 최근 6개월 가격과 거래량`}
                  />

                  <div className="why">
                    {current.reasons.length > 0 && (
                      <p className="why-lead"><Marked text={current.reasons[0]} /></p>
                    )}
                    {current.reasons.length > 1 && (
                      <ul className="why-list">
                        {current.reasons.slice(1).map((r) => (
                          <li key={r}><Marked text={r} /></li>
                        ))}
                      </ul>
                    )}
                    {current.cautions.length > 0 && (
                      <ul className="why-caution">
                        {current.cautions.map((c) => (
                          <li key={c}><Marked text={c} /></li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <PositionPanel stock={current.stock} />

                  <details>
                    <summary>근거 지표 보기</summary>
                    <table className="ev">
                      <thead>
                        <tr>
                          <th scope="col">지표</th>
                          <th scope="col">값</th>
                          <th scope="col">전체 {data.stocks.length}개 중 위치</th>
                        </tr>
                      </thead>
                      <tbody>
                        <EvRow label="1일 등락" value={signed(current.metrics.ret1)} cls={current.metrics.ret1 >= 0 ? 'up' : 'down'} />
                        <EvRow label="1주 등락" value={signed(current.metrics.ret5)} cls={current.metrics.ret5 >= 0 ? 'up' : 'down'} />
                        <EvRow label="1개월 수익률(참고, 점수 제외)" value={signed(current.metrics.ret20)} cls={current.metrics.ret20 >= 0 ? 'up' : 'down'} />
                        <EvRow label="3개월 수익률(최근 1개월 제외)" value={signed(current.metrics.mom60)} cls={current.metrics.mom60 >= 0 ? 'up' : 'down'} pct={current.pct.ret60} />
                        <EvRow label="6개월 수익률(최근 1개월 제외)" value={signed(current.metrics.mom120)} cls={current.metrics.mom120 >= 0 ? 'up' : 'down'} pct={current.pct.ret120} />
                        <EvRow label="거래량(1주 평균/3개월 평균)" value={`${current.metrics.volRatio.toFixed(1)}배`} pct={current.pct.volRatio} />
                        <EvRow label="일간 변동성(길수록 안정)" value={plain(current.metrics.vol, 2)} pct={current.pct.stability} />
                      </tbody>
                    </table>
                    <p className="muted">
                      1일·1주·1개월 등락은 참고용이고 점수에는 넣지 않습니다(모멘텀은 최근 1개월을 뺀 수익률). 후보는 {result.candidateCount}개였고, 막대는 전체 종목 중 백분위입니다.
                    </p>
                  </details>

                  <NewsPanel key={current.stock.code} name={current.stock.name} />
                </article>

                <section className="panel tint-sky" aria-labelledby="alloc-title">
                  <div className="panel-head">
                    <h2 id="alloc-title">예산 배분</h2>
                    <span className="muted num">투자 {krw(result.invested)}, 남는 돈 {krw(result.cash)}</span>
                  </div>
                  <div className="bar" role="img" aria-label="종목별 투자 비중">
                    {picks.map((p, i) => (
                      <span key={p.stock.code} style={{ width: `${p.weight * 100}%`, background: COLORS[i % COLORS.length] }} />
                    ))}
                  </div>
                  <ul className="alloc">
                    {picks.map((p, i) => (
                      <li key={p.stock.code}>
                        <i style={{ background: COLORS[i % COLORS.length] }} />
                        <span>{p.stock.name}</span>
                        <span className="num">{p.shares}주</span>
                        <span className="num">{plain(p.weight, 0)}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <PortfolioShift portfolio={portfolio} picks={picks} metrics={metrics} byCode={byCode} sectorName={sectorName} />
              </>
            )}

            <AlertsBlock stocks={alertStocks} universe={data.stocks} />

          </div>

          <aside className="side">
            {holdPanel}
            {watchPanel}
          </aside>
        </div>
      )}

      {tab === 'explore' && (
        <Explore
          data={data}
          metrics={metrics}
          picks={picks}
          watch={watch}
          onToggle={toggleWatch}
          onOpen={setDetailCode}
          sectorName={sectorName}
        />
      )}

      {tab === 'watch' && (
        <div className={holdPanel ? 'dash' : undefined}>
        <div className="stack-gap">
          <AlertsBlock stocks={data.stocks.filter((st) => watch.includes(st.code))} universe={data.stocks} />
          {watch.length === 0 ? (
            <section className="panel">
              <p>아직 담은 종목이 없습니다. 추천 화면이나 종목 탐색에서 ☆ 버튼으로 담아 보십시오.</p>
            </section>
          ) : (
            watch.map((code) => {
              const s = byCode.get(code)
              const m = metrics.get(code)
              if (!s || !m) return null
              return (
                <article key={code} className="panel">
                  <div className="panel-head">
                    <div className="hero-title">
                      <Avatar name={s.name} sector={s.sector} />
                      <h2>
                        <button className="row-open" onClick={() => setDetailCode(code)} aria-label={`${s.name} 상세 보기`}>
                          {s.name}
                        </button>
                      </h2>
                    </div>
                    <StarButton on onClick={() => toggleWatch(code)} />
                  </div>
                  <div className="price-line">
                    <span className="price num">{krw(m.price)}</span>
                    <span className={`num ${m.ret1 >= 0 ? 'up' : 'down'}`}>{signed(m.ret1)}</span>
                    <span className="muted">{sectorName(s.sector)}</span>
                  </div>
                  <PriceChart dates={s.dates} close={s.close} volume={s.volume} label={`${s.name} 최근 6개월 가격과 거래량`} />
                  <NewsPanel name={s.name} />
                </article>
              )
            })
          )}
        </div>
        {holdPanel && <aside className="side">{holdPanel}</aside>}
        </div>
      )}

      {switchOpen && (
        <SectorSwitchModal
          suggested={sectorSuggestions.map((x) => x.id)}
          current={profile.sectors}
          sectorName={sectorName}
          onAccept={() => {
            setSwitchOpen(false)
            onChangeConditions({ sectors: sectorSuggestions.map((x) => x.id) })
            setSel(0)
            goRecommend()
          }}
          onKeep={() => {
            setSwitchOpen(false)
            goRecommend()
          }}
          onClose={() => setSwitchOpen(false)}
        />
      )}

      {brokerOpen && (
        <BrokerModal
          data={data}
          onConnected={(acc) => {
            setBrokerOpen(false)
            onAccountConnected(acc)
            setTab('account')
            window.scrollTo(0, 0)
          }}
          onClose={() => setBrokerOpen(false)}
        />
      )}

      {condOpen && (
        <ConditionsModal
          values={{ budget: profile.budget, risk: profile.risk, horizon: profile.horizon, sectors: profile.sectors }}
          sectors={data.sectors}
          minBudget={minBudget}
          cash={cash}
          onChange={onChangeConditions}
          onRestart={() => {
            setCondOpen(false)
            onRestart()
          }}
          onClose={() => setCondOpen(false)}
        />
      )}

      {detailCode && byCode.get(detailCode) && metrics.get(detailCode) && (
        <StockModal
          stock={byCode.get(detailCode)!}
          metrics={metrics.get(detailCode)!}
          sectorName={sectorName(byCode.get(detailCode)!.sector)}
          alerts={checkAlerts([byCode.get(detailCode)!])}
          watched={watch.includes(detailCode)}
          onToggleWatch={() => toggleWatch(detailCode)}
          onClose={() => setDetailCode(null)}
        />
      )}

    </div>
  )
}

/** 보유 주식에 이번 추천을 더했을 때 업종 비중이 어떻게 바뀌는지 계산해 보여준다. */
function PortfolioShift({
  portfolio,
  picks,
  metrics,
  byCode,
  sectorName,
}: {
  portfolio: Holding[]
  picks: Pick[]
  metrics: Map<string, Metrics>
  byCode: Map<string, Stock>
  sectorName: (id: string) => string
}) {
  const before: Record<string, number> = {}
  for (const h of portfolio) {
    const s = byCode.get(h.code)
    const m = metrics.get(h.code)
    if (!s || !m || h.qty <= 0) continue
    before[s.sector] = (before[s.sector] ?? 0) + m.price * h.qty
  }
  const beforeTotal = Object.values(before).reduce((a, b) => a + b, 0)
  if (beforeTotal <= 0) return null

  const after: Record<string, number> = { ...before }
  for (const p of picks) after[p.stock.sector] = (after[p.stock.sector] ?? 0) + p.cost
  const afterTotal = Object.values(after).reduce((a, b) => a + b, 0)
  const ids = Object.keys(after).sort((a, b) => after[b] - after[a])

  const bar = (vals: Record<string, number>, total: number, label: string) => (
    <div className="shift-row">
      <span className="muted">{label}</span>
      <div className="bar" role="img" aria-label={`${label} 업종 비중`}>
        {ids.filter((id) => (vals[id] ?? 0) > 0).map((id) => (
          <span key={id} style={{ width: `${((vals[id] ?? 0) / total) * 100}%`, background: sectorColor(id)[1] }} />
        ))}
      </div>
    </div>
  )

  return (
    <section className="panel tint-violet" aria-labelledby="shift-title">
      <div className="panel-head">
        <h2 id="shift-title">추가 투자 후 업종 비중</h2>
      </div>
      {bar(before, beforeTotal, '지금')}
      {bar(after, afterTotal, '추가 후')}
      <ul className="shift-legend">
        <li className="head" aria-hidden="true">
          <i />
          <span>업종</span>
          <span className="num">지금</span>
          <span className="num">추가 후</span>
        </li>
        {ids.map((id) => {
          const b = (before[id] ?? 0) / beforeTotal
          const a = (after[id] ?? 0) / afterTotal
          return (
            <li key={id}>
              <i style={{ background: sectorColor(id)[1] }} />
              <span>{sectorName(id)}</span>
              <span className="num muted">{plain(b, 0)}</span>
              <span className="num">{plain(a, 0)}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function StarButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button className="star" aria-pressed={on} onClick={onClick} aria-label={on ? '관심 종목에서 빼기' : '관심 종목에 담기'}>
      {on ? '★ 관심' : '☆ 관심'}
    </button>
  )
}

function WatchRow({
  stock,
  m,
  flag,
  onOpen,
}: {
  stock?: Stock
  m?: Metrics
  flag?: AlertGroup
  onOpen: () => void
}) {
  if (!stock || !m) return null
  return (
    <li>
      <Avatar name={stock.name} sector={stock.sector} size="sm" />
      <button className="nm row-open" onClick={onOpen} aria-label={`${stock.name} 상세 보기`}>
        {stock.name}
        <span className="sub num">{krw(m.price)}</span>
      </button>
      <span className={`num ${m.ret20 >= 0 ? 'up' : 'down'}`}>{signed(m.ret20)}</span>
      {flag && <span className="flag">{flag.items[0].title}: {flag.items[0].detail}</span>}
    </li>
  )
}

type SortKey = 'name' | 'price' | 'ret1' | 'ret5' | 'ret20' | 'ret60' | 'ret120' | 'volRatio' | 'vol'

const PAGE_SIZE = 10

const RET_LABEL: Partial<Record<SortKey, string>> = { ret1: '1일', ret5: '1주', ret20: '1개월', ret60: '3개월', ret120: '6개월' }

function Explore({
  data,
  metrics,
  picks,
  watch,
  onToggle,
  onOpen,
  sectorName,
}: {
  data: Dataset
  metrics: Map<string, Metrics>
  picks: Pick[]
  watch: string[]
  onToggle: (code: string) => void
  onOpen: (code: string) => void
  sectorName: (id: string) => string
}) {
  const [sector, setSectorRaw] = useState('all')
  const [sort, setSortRaw] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'ret20', dir: -1 })
  const [page, setPage] = useState(1)
  const pickCodes = new Set(picks.map((p) => p.stock.code))
  // 필터나 정렬을 바꾸면 1페이지로 돌아간다.
  const setSector = (v: string) => {
    setSectorRaw(v)
    setPage(1)
  }
  const setSort = (v: { key: SortKey; dir: 1 | -1 } | ((cur: { key: SortKey; dir: 1 | -1 }) => { key: SortKey; dir: 1 | -1 })) => {
    setSortRaw(v)
    setPage(1)
  }

  const rows = data.stocks
    .filter((s) => sector === 'all' || s.sector === sector)
    .map((s) => ({ s, m: metrics.get(s.code)! }))
    .sort((a, b) => {
      if (sort.key === 'name') return a.s.name.localeCompare(b.s.name, 'ko') * sort.dir
      const k = sort.key
      return (a.m[k] - b.m[k]) * sort.dir
    })
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const curPage = Math.min(page, pageCount)
  const pageRows = rows.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE)

  // 좁은 화면에서는 지표 열을 숨기고, 정렬 기준 지표를 현재가 아래에 보여준다.
  const metricKey: Exclude<SortKey, 'name' | 'price'> = sort.key === 'name' || sort.key === 'price' ? 'ret20' : sort.key
  const isRet = metricKey in RET_LABEL
  const metricText = (m: Metrics) =>
    metricKey === 'volRatio' ? `거래량 ${m.volRatio.toFixed(1)}배` : metricKey === 'vol' ? `변동성 ${plain(m.vol, 2)}` : `${RET_LABEL[metricKey]} ${signed(m[metricKey])}`
  const metricCls = (m: Metrics) => (isRet ? (m[metricKey] >= 0 ? 'up' : 'down') : '')

  const head = (key: SortKey, label: string, cls?: string) => (
    <th scope="col" className={cls} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
      <button onClick={() => setSort((cur) => (cur.key === key ? { key, dir: cur.dir === 1 ? -1 : 1 } : { key, dir: key === 'name' ? 1 : -1 }))}>
        {label}
        {sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  )

  return (
    <section aria-labelledby="explore-title">
      <div className="toolbar">
        <h2 id="explore-title">전체 {rows.length}개 종목</h2>
        <label className="muted" htmlFor="sector-filter">업종</label>
        <select id="sector-filter" value={sector} onChange={(e) => setSector(e.target.value)}>
          <option value="all">전체</option>
          {Object.entries(data.sectors).map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <label className="muted" htmlFor="sort-key">정렬</label>
        <select
          id="sort-key"
          value={sort.key}
          onChange={(e) => {
            const key = e.target.value as SortKey
            setSort({ key, dir: key === 'name' ? 1 : -1 })
          }}
        >
          <option value="ret1">1일 등락 높은 순</option>
          <option value="ret5">1주 등락 높은 순</option>
          <option value="ret20">1개월 수익률 높은 순</option>
          <option value="ret60">3개월 수익률 높은 순</option>
          <option value="ret120">6개월 수익률 높은 순</option>
          <option value="volRatio">거래량 증가 큰 순</option>
          <option value="vol">변동성 큰 순</option>
          <option value="price">현재가 높은 순</option>
          <option value="name">이름순</option>
        </select>
        <span className="muted toolbar-note">표 제목을 눌러도 정렬됩니다. 추천 종목은 표시해 두었습니다.</span>
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              {head('name', '종목')}
              {head('price', '현재가')}
              {head('ret1', '1일', 'col-m')}
              {head('ret5', '1주', 'col-m')}
              {head('ret20', '1개월', 'col-m')}
              {head('ret60', '3개월', 'col-m')}
              {head('ret120', '6개월', 'col-m')}
              {head('volRatio', '거래량(배)', 'col-m')}
              {head('vol', '변동성', 'col-m')}
              <th scope="col"><span className="muted">관심</span></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(({ s, m }) => (
              <tr key={s.code}>
                <td>
                  <button className="who row-open" onClick={() => onOpen(s.code)} aria-label={`${s.name} 상세 보기`}>
                    <Avatar name={s.name} sector={s.sector} size="sm" />
                    <span>
                      <span className="nm">{s.name}{pickCodes.has(s.code) && <span className="badge">추천</span>}</span>
                      <span className="sub">{sectorName(s.sector)}</span>
                    </span>
                  </button>
                </td>
                <td className="num">
                  {krw(m.price)}
                  <span className={`sub m-only ${metricCls(m)}`}>{metricText(m)}</span>
                </td>
                {(['ret1', 'ret5', 'ret20', 'ret60', 'ret120'] as const).map((k) => (
                  <td key={k} className={`num col-m ${m[k] >= 0 ? 'up' : 'down'}`}>{signed(m[k])}</td>
                ))}
                <td className="num col-m">{m.volRatio.toFixed(1)}</td>
                <td className="num col-m">{plain(m.vol, 2)}</td>
                <td>
                  <button
                    className="starlink"
                    aria-pressed={watch.includes(s.code)}
                    aria-label={`${s.name} ${watch.includes(s.code) ? '관심 종목에서 빼기' : '관심 종목에 담기'}`}
                    onClick={() => onToggle(s.code)}
                  >
                    {watch.includes(s.code) ? '★' : '☆'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <nav className="pager" aria-label="페이지 이동">
          <button className="pg" disabled={curPage === 1} onClick={() => setPage(curPage - 1)}>
            이전
          </button>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              className="pg num"
              aria-current={n === curPage ? 'page' : undefined}
              aria-label={`${n}페이지`}
              onClick={() => setPage(n)}
            >
              {n}
            </button>
          ))}
          <button className="pg" disabled={curPage === pageCount} onClick={() => setPage(curPage + 1)}>
            다음
          </button>
          <span className="muted pg-info num">
            {(curPage - 1) * PAGE_SIZE + 1}~{Math.min(curPage * PAGE_SIZE, rows.length)} / {rows.length}개
          </span>
        </nav>
      )}
    </section>
  )
}

interface AlertGroup {
  code: string
  name: string
  level: 'warn' | 'info'
  items: Alert[]
}

function groupAlerts(alerts: Alert[]): AlertGroup[] {
  const map = new Map<string, AlertGroup>()
  for (const a of alerts) {
    const g = map.get(a.code) ?? { code: a.code, name: a.name, level: a.level, items: [] }
    if (a.level === 'warn') g.level = 'warn'
    g.items.push(a)
    map.set(a.code, g)
  }
  return [...map.values()].sort((a, b) => (a.level === b.level ? 0 : a.level === 'warn' ? -1 : 1))
}

/**
 * 주의가 필요한 종목: '확인 필요' 수준만 보여 주고, 점검 기간(1일~6개월)을 고를 수 있다.
 * 종목이 없으면 '해당 기간에 확인할 신호가 없습니다'를 보여 준다.
 */
function AlertsBlock({ stocks, universe }: { stocks: Stock[]; universe: Stock[] }) {
  const [period, setPeriod] = useState<AlertPeriodKey>('1w')
  const groups = useMemo(() => groupAlerts(periodAlerts(stocks, universe, period)), [stocks, universe, period])
  if (stocks.length === 0) return null
  return (
    <section className="watch" aria-labelledby="watch-title">
      <div className="watch-head">
        <h2 id="watch-title">주의가 필요한 종목</h2>
        <div className="seg" role="group" aria-label="점검 기간">
          {ALERT_PERIODS.map((p) => (
            <button key={p.key} aria-pressed={period === p.key} onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {groups.length === 0 ? (
        <p className="watch-empty">이 기간에는 확인이 필요한 신호가 없습니다.</p>
      ) : (
        <ul>
          {groups.map((g) => (
            <AlertItem key={g.code} g={g} />
          ))}
        </ul>
      )}
    </section>
  )
}

function AlertItem({ g }: { g: AlertGroup }) {
  return (
    <li className={g.level}>
      <b>{g.name}</b>
      {g.items.map((a) => (
        <span key={a.title} className="alert-line">
          {a.title}: {a.detail}
        </span>
      ))}
    </li>
  )
}

function EvRow({ label, value, cls, pct }: { label: string; value: string; cls?: string; pct?: number }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td className={`v num ${cls ?? ''}`}>{value}</td>
      <td>
        {pct == null ? (
          <span className="muted">참고</span>
        ) : (
          <div className="track" role="img" aria-label={`상위 ${Math.max(1, Math.round(100 - pct))}%`}>
            <i style={{ width: `${Math.max(3, pct)}%` }} />
          </div>
        )}
      </td>
    </tr>
  )
}

/**
 * 추천 종목 카드를 가로로 넘겨 보는 슬라이드.
 * 마우스로 끌어서 넘길 수 있고, 양옆의 반투명 버튼으로도 넘긴다.
 * 한 줄에 다 안 들어갈 때만 아래에 위치 막대를 보여 주며, 막대를 누르면 그 위치로 이동한다.
 */
function MiniSlider({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef({ active: false, moved: false, startX: 0, startLeft: 0 })
  const [dragging, setDragging] = useState(false)
  const [bar, setBar] = useState({ show: false, left: 0, width: 100, canPrev: false, canNext: false })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const over = el.scrollWidth - el.clientWidth
      if (over <= 2) return setBar((b) => (b.show ? { show: false, left: 0, width: 100, canPrev: false, canNext: false } : b))
      const width = (el.clientWidth / el.scrollWidth) * 100
      const left = (el.scrollLeft / over) * (100 - width)
      setBar({ show: true, left, width, canPrev: el.scrollLeft > 4, canNext: el.scrollLeft < over - 4 })
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [children])

  const step = (dir: 1 | -1) => {
    const el = ref.current
    if (!el) return
    const card = el.firstElementChild as HTMLElement | null
    const w = card ? card.getBoundingClientRect().width + 12 : el.clientWidth * 0.8
    el.scrollBy({ left: dir * w, behavior: 'smooth' })
  }

  return (
    <div className="mini-slider">
      <div className="slider-view">
        <div
          className={`minis${dragging ? ' dragging' : ''}`}
          role="group"
          aria-label="추천 종목 선택"
          ref={ref}
          onPointerDown={(e) => {
            if (e.pointerType !== 'mouse' || e.button !== 0 || !ref.current) return
            drag.current = { active: true, moved: false, startX: e.clientX, startLeft: ref.current.scrollLeft }
          }}
          onPointerMove={(e) => {
            const d = drag.current
            if (!d.active || !ref.current) return
            const dx = e.clientX - d.startX
            if (!d.moved && Math.abs(dx) > 5) {
              d.moved = true
              setDragging(true)
            }
            if (d.moved) ref.current.scrollLeft = d.startLeft - dx
          }}
          onPointerUp={() => {
            drag.current.active = false
            setDragging(false)
          }}
          onPointerLeave={() => {
            drag.current.active = false
            setDragging(false)
          }}
          onClickCapture={(e) => {
            // 끌고 나서 손을 뗄 때 카드가 눌리지 않게 막는다.
            if (drag.current.moved) {
              e.preventDefault()
              e.stopPropagation()
              drag.current.moved = false
            }
          }}
        >
          {children}
        </div>
        {bar.canPrev && (
          <button className="slide-btn prev" aria-label="이전 종목 보기" onClick={() => step(-1)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
        )}
        {bar.canNext && (
          <button className="slide-btn next" aria-label="다음 종목 보기" onClick={() => step(1)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        )}
      </div>
      {bar.show && (
        <div
          className="slide-bar"
          aria-hidden="true"
          onClick={(e) => {
            const el = ref.current
            if (!el) return
            const r = e.currentTarget.getBoundingClientRect()
            const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
            el.scrollTo({ left: ratio * (el.scrollWidth - el.clientWidth), behavior: 'smooth' })
          }}
        >
          <i style={{ left: `${bar.left}%`, width: `${bar.width}%` }} />
        </div>
      )}
    </div>
  )
}
