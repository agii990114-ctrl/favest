import { useMemo, useState } from 'react'
import raw from './data/stocks.json'
import type { Dataset, Horizon, Risk } from './lib/types'
import { recommend } from './lib/engine'
import { DAILY_HINTS, HORIZON_OPTIONS, QUESTIONS, RISK_INFO, classify, type Answers } from './lib/quiz'
import RiskResult from './components/RiskResult'
import { summarizeTrades, type TradeSummary } from './lib/trades'
import { HORIZON_LABEL, RISK_LABEL, RISK_ORDER, krw } from './lib/format'
import { currentUser, loadSetup, logOut, saveSetup, type Holding, type SavedSetup, type SessionUser } from './lib/auth'
import { SaeumDemoBroker, summarizeAccount, type BrokerAccount } from './lib/broker'
import Auth from './components/Auth'
import Landing from './components/Landing'
import Result from './components/Result'
import Avatar from './components/Avatar'
import MoneyInput, { BudgetAddButtons } from './components/MoneyInput'

const data = raw as Dataset

type Experience = 'new' | 'existing'
type Method = 'quiz' | 'file' | 'manual' | 'broker'
type Step = 'start' | 'method' | 'budget' | 'quiz' | 'trades' | 'manual' | 'broker' | 'horizon' | 'sectors' | 'result'

const FLOW: Record<Method, Step[]> = {
  quiz: ['budget', 'quiz', 'sectors', 'result'],
  file: ['budget', 'trades', 'sectors', 'result'],
  manual: ['budget', 'manual', 'sectors', 'result'],
  broker: ['broker', 'sectors', 'result'],
}

const MIN_BUDGET = 300_000
const SECTOR_COUNT = Object.keys(data.sectors).length

const SECTOR_DESC: Record<string, string> = {
  semiconductor: '스마트폰·AI 서버에 들어가는 칩',
  battery: '전기차 배터리와 소재, 에너지',
  bio: '의약품과 의료',
  auto: '완성차와 부품',
  finance: '은행·증권·보험',
  platform: '검색·메신저·인터넷 서비스',
  game: '게임과 K-콘텐츠',
  consumer: '식음료·화장품·유통',
}

export default function App() {
  // 저장된 조건이 있는 재방문 사용자는 설문 없이 그 조건의 추천 화면에서 바로 시작한다.
  const [boot] = useState(() => {
    const u = currentUser()
    return { u, s: u ? loadSetup(u.email) : null }
  })
  // 로그인 전에는 소개 화면을 먼저 보여 주고, 로그인 버튼을 누르면 로그인 화면으로 넘어간다.
  const [showAuth, setShowAuth] = useState(false)
  const [user, setUser] = useState<SessionUser | null>(boot.u)
  const [saved, setSaved] = useState<SavedSetup | null>(boot.s)
  const [welcomeName, setWelcomeName] = useState<string | null>(boot.u && boot.s ? boot.u.nickname : null)

  const [step, setStep] = useState<Step>(boot.s ? 'result' : 'start')
  const [experience, setExperience] = useState<Experience>(boot.s?.experience ?? 'new')
  const [method, setMethod] = useState<Method>(boot.s?.method ?? 'quiz')
  const [budget, setBudget] = useState(boot.s?.budget ?? 3_000_000)
  const [answers, setAnswers] = useState<Answers>({})
  const [riskOverride, setRiskOverride] = useState<Risk | null>(boot.s?.risk ?? null)
  const [horizon, setHorizon] = useState<Horizon>(boot.s?.horizon ?? 'mid')
  const [horizonUnknown, setHorizonUnknown] = useState(false)
  const [sectors, setSectors] = useState<string[]>(boot.s?.sectors ?? [])
  const [trades, setTrades] = useState<TradeSummary | null>(null)
  const [portfolio, setPortfolio] = useState<Holding[]>(boot.s?.portfolio ?? [])
  const [cash, setCash] = useState<number | null>(boot.s?.cash ?? null)
  const [tradeError, setTradeError] = useState('')
  const [account, setAccount] = useState<BrokerAccount | null>(null)
  const [consent, setConsent] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const accountSummary = useMemo(() => (account ? summarizeAccount(account, data) : null), [account])
  const quiz = useMemo(() => classify(answers), [answers])
  const inferred = method === 'file' && trades ? trades.inferredRisk : method === 'broker' && accountSummary ? accountSummary.inferredRisk : null
  const risk: Risk = riskOverride ?? inferred ?? quiz.risk

  const usesPortfolio = method === 'file' || method === 'broker'
  // 모든 업종을 고르면 '전체 업종'과 같으므로 빈 목록으로 다룬다.
  const effectiveSectors = useMemo(() => (sectors.length >= SECTOR_COUNT ? [] : sectors), [sectors])
  const profile = useMemo(
    () => ({ budget, risk, horizon, sectors: effectiveSectors, holdings: usesPortfolio ? portfolio.map((h) => h.code) : [] }),
    [budget, risk, horizon, effectiveSectors, usesPortfolio, portfolio],
  )
  const result = useMemo(() => (step === 'result' ? recommend(data, profile) : null), [step, profile])

  const flow = FLOW[method]
  const stepIndex = flow.indexOf(step)

  const scrollTop = () => window.scrollTo(0, 0)

  function resetInputs() {
    setAnswers({})
    setRiskOverride(null)
    setHorizon('mid')
    setHorizonUnknown(false)
    setSectors([])
    setTrades(null)
    setPortfolio([])
    setCash(null)
    setTradeError('')
    setAccount(null)
    setConsent(false)
    setConnecting(false)
  }

  function next() {
    const n = flow[stepIndex + 1]
    if (!n) return
    // 문항 7(투자 예정 기간)의 답을 추천의 투자 기간으로 쓴다(모르면 중기).
    if (step === 'quiz') setHorizon(quiz.horizon ?? 'mid')
    if (n === 'result' && user) {
      const setup: SavedSetup = {
        experience,
        method,
        budget,
        risk,
        horizon,
        sectors: profile.sectors,
        holdings: profile.holdings,
        portfolio: usesPortfolio ? portfolio : [],
        cash: method === 'broker' && cash != null ? cash : undefined,
      }
      saveSetup(user.email, setup)
      setSaved(setup)
    }
    setStep(n)
    scrollTop()
  }

  function prev() {
    if (stepIndex > 0) setStep(flow[stepIndex - 1])
    else setStep(experience === 'existing' ? 'method' : 'start')
    scrollTop()
  }

  function chooseExperience(e: Experience) {
    setExperience(e)
    resetInputs()
    if (e === 'new') {
      setMethod('quiz')
      setStep('budget')
    } else {
      setStep('method')
    }
    scrollTop()
  }

  function chooseMethod(m: Method) {
    setMethod(m)
    resetInputs()
    setStep(FLOW[m][0])
    scrollTop()
  }

  async function connectBroker() {
    setConnecting(true)
    try {
      const acc = await SaeumDemoBroker.fetchAccount(data)
      setAccount(acc)
      setPortfolio(acc.positions.map((p) => ({ code: p.code, qty: p.qty, avgPrice: p.avgPrice })))
      setCash(acc.cash)
      setBudget(acc.cash)
      setRiskOverride(null)
    } finally {
      setConnecting(false)
    }
  }

  function runSaved(s: SavedSetup) {
    setExperience(s.experience)
    setMethod(s.method)
    setBudget(s.budget)
    setRiskOverride(s.risk)
    setHorizon(s.horizon)
    setSectors(s.sectors)
    setPortfolio(s.portfolio ?? [])
    setCash(s.cash ?? null)
    setTrades(null)
    setStep('result')
    scrollTop()
  }

  /** 대시보드의 계좌 연결 팝업에서 연결을 마치면 보유 종목·예수금을 반영하고 저장한다(현재 조건은 유지). */
  function connectAccount(acc: BrokerAccount) {
    const nextPortfolio = acc.positions.map((p) => ({ code: p.code, qty: p.qty, avgPrice: p.avgPrice }))
    setAccount(acc)
    setPortfolio(nextPortfolio)
    setCash(acc.cash)
    setExperience('existing')
    setMethod('broker')
    if (user) {
      const setup: SavedSetup = {
        experience: 'existing',
        method: 'broker',
        budget,
        risk,
        horizon,
        sectors: profile.sectors,
        holdings: nextPortfolio.map((h) => h.code),
        portfolio: nextPortfolio,
        cash: acc.cash,
      }
      saveSetup(user.email, setup)
      setSaved(setup)
    }
  }

  /** 문항 답 고르기. 복수 선택 문항은 토글하며, '투자 경험 없음'(0번)은 다른 선택과 함께 고를 수 없다. */
  function pickAnswer(id: string, index: number, multi: boolean) {
    setAnswers((a) => {
      if (!multi) return { ...a, [id]: [index] }
      const cur = Array.isArray(a[id]) ? (a[id] as number[]) : []
      if (index === 0) return { ...a, [id]: cur.includes(0) ? [] : [0] }
      const rest = cur.filter((i) => i !== 0)
      return { ...a, [id]: rest.includes(index) ? rest.filter((i) => i !== index) : [...rest, index] }
    })
  }

  /** 조건 수정 팝업에서 바꾼 값을 바로 반영하고, 저장된 조건도 함께 갱신한다. */
  function changeConditions(patch: Partial<{ budget: number; risk: Risk; horizon: Horizon; sectors: string[] }>) {
    const next = {
      budget: patch.budget ?? budget,
      risk: patch.risk ?? risk,
      horizon: patch.horizon ?? horizon,
      sectors: patch.sectors ?? sectors,
    }
    if (patch.budget != null) setBudget(patch.budget)
    if (patch.risk != null) setRiskOverride(patch.risk)
    if (patch.horizon != null) setHorizon(patch.horizon)
    if (patch.sectors != null) setSectors(patch.sectors)
    if (user) {
      const setup: SavedSetup = {
        experience,
        method,
        budget: next.budget,
        risk: next.risk,
        horizon: next.horizon,
        sectors: next.sectors.length >= SECTOR_COUNT ? [] : next.sectors,
        holdings: profile.holdings,
        portfolio: usesPortfolio ? portfolio : [],
        cash: method === 'broker' && cash != null ? cash : undefined,
      }
      saveSetup(user.email, setup)
      setSaved(setup)
    }
  }

  function restart() {
    resetInputs()
    setWelcomeName(null)
    setStep('start')
    scrollTop()
  }

  function applyTrades(text: string) {
    try {
      const s = summarizeTrades(text, data)
      setTrades(s)
      setPortfolio(s.holdings.map((h) => ({ code: h.code, qty: h.qty, avgPrice: h.avgPrice })))
      setHorizon(s.inferredHorizon)
      setRiskOverride(null)
      setTradeError('')
    } catch (e) {
      setTrades(null)
      setPortfolio([])
      setTradeError(e instanceof Error ? e.message : '파일을 읽지 못했습니다.')
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    applyTrades(await file.text())
  }

  async function useSample() {
    try {
      const res = await fetch('/sample_trades.csv')
      applyTrades(await res.text())
    } catch {
      setTradeError('샘플 파일을 불러오지 못했습니다.')
    }
  }

  function toggleSector(id: string) {
    setSectors((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    )
  }

  function toggleHint(ids: string[]) {
    setSectors((cur) => {
      const allOn = ids.every((i) => cur.includes(i))
      if (allOn) return cur.filter((i) => !ids.includes(i))
      return [...new Set([...cur, ...ids])]
    })
  }

  function onAuthed(u: SessionUser) {
    const s = loadSetup(u.email)
    setUser(u)
    setSaved(s)
    if (s) {
      runSaved(s)
      setWelcomeName(u.nickname)
    } else {
      setStep('start')
    }
  }

  /** 로고: 저장된 조건이 있으면 그 추천 화면으로, 없으면 시작 화면으로 */
  function goHome() {
    resetInputs()
    setWelcomeName(null)
    if (saved) runSaved(saved)
    else setStep('start')
    scrollTop()
  }

  function handleLogout() {
    logOut()
    setShowAuth(false)
    setUser(null)
    setSaved(null)
    setWelcomeName(null)
    resetInputs()
    setStep('start')
  }

  const progress =
    user && step !== 'start' && step !== 'method' && step !== 'result' ? (
      <div className="stepbar" aria-hidden="true">
        {flow.slice(0, -1).map((s, i) => (
          <i key={s} className={i <= stepIndex ? 'on' : ''} />
        ))}
      </div>
    ) : null

  if (!user && !showAuth) return <Landing onLogin={() => setShowAuth(true)} />

  return (
    <div className="shell">
      <header className="masthead">
        {user ? (
          <button className="brand brand-btn" onClick={goHome} aria-label="FAVEST 홈으로">FAVEST</button>
        ) : (
          <button className="brand brand-btn" onClick={() => setShowAuth(false)} aria-label="처음 화면으로">FAVEST</button>
        )}
        <div className="mast-meta">
          <span>
            기준일 <span className="num">{data.asOf}</span>
          </span>
          <span>샘플 데이터</span>
          {user && (
            <>
              <span>{user.nickname} 님</span>
              <button className="link" onClick={handleLogout}>로그아웃</button>
            </>
          )}
        </div>
      </header>

      {!user && <Auth onAuthed={onAuthed} sample={data.stocks[0]} />}


      {user && step === 'start' && (
        <div className="stage">
          {saved && (
            <section className="saved">
              <h2>저장된 조건이 있습니다</h2>
              <p className="muted">
                예산 <span className="num">{krw(saved.budget)}</span>, {RISK_LABEL[saved.risk]}, {HORIZON_LABEL[saved.horizon]},{' '}
                {saved.sectors.length ? saved.sectors.map((s) => data.sectors[s]).join(' / ') : '전체 업종'}
              </p>
              <button className="btn primary" onClick={() => runSaved(saved)}>이 조건으로 추천 받기</button>
            </section>
          )}
          <h1 className="q">{saved ? '새로 설정하시겠습니까?' : `${user.nickname} 님, 투자해 본 적이 있습니까?`}</h1>
          <p className="hint">경험에 따라 입력 방식이 달라집니다. 실제 매매나 계좌 연동은 없습니다.</p>
          <div className="opts">
            <button className="opt go" onClick={() => chooseExperience('new')}>
              <span><b>거래가 처음입니다</b><small>질문 몇 개로 투자 성향을 알아봅니다.</small></span>
            </button>
            <button className="opt go" onClick={() => chooseExperience('existing')}>
              <span><b>거래 경험이 있습니다</b><small>내역 파일을 올리거나 조건을 직접 정할 수 있습니다.</small></span>
            </button>
          </div>
        </div>
      )}

      {user && step === 'method' && (
        <div className="stage">
          <h1 className="q">어떤 방식으로 진행하시겠습니까?</h1>
          <p className="hint">편한 방법을 골라 주십시오. 나중에 언제든 다시 설정할 수 있습니다.</p>
          <div className="opts">
            <button className="opt go" onClick={() => chooseMethod('broker')}>
              <span><b>증권사 계좌 연결 (데모)</b><small>예수금과 보유 종목을 불러와 추가로 넣을 곳을 찾습니다.</small></span>
            </button>
            <button className="opt go" onClick={() => chooseMethod('file')}>
              <span><b>거래내역 파일 첨부</b><small>내 거래 패턴과 보유 종목을 반영합니다.</small></span>
            </button>
            <button className="opt go" onClick={() => chooseMethod('manual')}>
              <span><b>조건 직접 설정</b><small>투자 성향과 기간을 직접 고릅니다.</small></span>
            </button>
            <button className="opt go" onClick={() => chooseMethod('quiz')}>
              <span><b>문항에 답하기</b><small>질문 5개로 성향을 알아봅니다.</small></span>
            </button>
          </div>
          <div className="nav">
            <button className="link" onClick={() => setStep('start')}>이전</button>
          </div>
        </div>
      )}

      {user && step === 'budget' && (
        <div className="stage">
          {progress}
          <h1 className="q">투자 예산은 얼마입니까?</h1>
          <p className="hint">생활비가 아닌 여유 자금으로 정하는 게 좋습니다. 최소 {krw(MIN_BUDGET)}부터 가능합니다.</p>
          <label className="field">
            <span>예산(원)</span>
            <MoneyInput className="big" value={budget} onChange={setBudget} />
          </label>
          <p className="muted num" style={{ marginBottom: 16 }}>
            {budget >= MIN_BUDGET ? '' : `${krw(MIN_BUDGET)} 이상 입력해 주십시오.`}
          </p>
          <BudgetAddButtons value={budget} onChange={setBudget} />
          <Nav onBack={prev} onNext={next} disabled={!(budget >= MIN_BUDGET)} />
        </div>
      )}

      {user && step === 'quiz' && (
        <div className="stage">
          {progress}
          <h1 className="q">투자성향을 분석하겠습니다</h1>
          <p className="hint">문항 7개에 답해 주십시오. 모르는 문항은 '잘 모르겠습니다'를 골라도 됩니다.</p>
          {QUESTIONS.map((q, qi) => {
            const picked = answers[q.id]
            return (
              <section key={q.id} className="quiz-q" aria-labelledby={`${q.id}-t`}>
                <p className="q-no">Q{qi + 1}</p>
                <h3 id={`${q.id}-t`}>{q.text}</h3>
                {q.help && <p className="muted">{q.help}</p>}
                <div className={`opts${q.cols ? ' cols' : ''}${q.multi ? ' multi' : ''}`}>
                  {q.options.map((o, oi) => (
                    <button
                      key={o.label}
                      className="opt"
                      aria-pressed={Array.isArray(picked) && picked.includes(oi)}
                      onClick={() => pickAnswer(q.id, oi, !!q.multi)}
                    >
                      <span>
                        <b>{o.label}</b>
                        {o.desc && <small>{o.desc}</small>}
                      </span>
                    </button>
                  ))}
                  <button
                    className="opt"
                    aria-pressed={picked === null}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: null }))}
                  >
                    <span><b style={{ fontWeight: 400, color: 'var(--ink-2)' }}>잘 모르겠습니다</b></span>
                  </button>
                </div>
              </section>
            )
          })}
          {quiz.answeredCount === QUESTIONS.length ? (
            <RiskResult
              name={user.nickname}
              risk={risk}
              basis={quiz.basis}
              overridden={riskOverride != null && riskOverride !== quiz.risk}
              onPick={(r) => setRiskOverride(r === quiz.risk ? null : r)}
            />
          ) : (
            <p className="muted quiz-left">남은 문항 {QUESTIONS.length - quiz.answeredCount}개에 답하면 결과가 나옵니다.</p>
          )}
          <Nav onBack={prev} onNext={next} disabled={quiz.answeredCount < QUESTIONS.length} />
        </div>
      )}

      {user && step === 'horizon' && (
        <div className="stage">
          {progress}
          <h1 className="q">이 돈은 언제쯤 쓸 예정입니까?</h1>
          <p className="hint">기간에 따라 최근 흐름과 꾸준함 중 무엇을 더 볼지 달라집니다.</p>
          <div className="opts">
            {HORIZON_OPTIONS.map((o) => (
              <button
                key={o.value}
                className="opt"
                aria-pressed={!horizonUnknown && horizon === o.value}
                onClick={() => {
                  setHorizon(o.value)
                  setHorizonUnknown(false)
                }}
              >
                <span><b>{o.label}</b><small>{o.desc}</small></span>
              </button>
            ))}
            <button
              className="opt"
              aria-pressed={horizonUnknown}
              onClick={() => {
                setHorizon('mid')
                setHorizonUnknown(true)
              }}
            >
              <span><b>잘 모르겠습니다</b><small>처음이라면 1~2년(중기)으로 시작하는 경우가 많습니다. 중기로 계산합니다.</small></span>
            </button>
          </div>
          <Nav onBack={prev} onNext={next} />
        </div>
      )}

      {user && step === 'manual' && (
        <div className="stage">
          {progress}
          <h1 className="q">조건을 직접 정해 주십시오</h1>
          <p className="hint">고른 성향과 기간에 따라 종목에 점수를 매기는 기준이 달라집니다.</p>
          <h2 className="q-sub" style={{ marginTop: 0 }}>투자 성향</h2>
          <div className="opts">
            {RISK_ORDER.map((r) => (
              <button key={r} className="opt" aria-pressed={risk === r} onClick={() => setRiskOverride(r)}>
                <span><b>{RISK_LABEL[r]}</b><small>{RISK_INFO[r].desc}</small></span>
              </button>
            ))}
          </div>
          <h2 className="q-sub">투자 기간</h2>
          <div className="opts">
            {HORIZON_OPTIONS.map((o) => (
              <button key={o.value} className="opt" aria-pressed={horizon === o.value} onClick={() => setHorizon(o.value)}>
                <span><b>{o.label}</b><small>{o.desc}</small></span>
              </button>
            ))}
          </div>
          <Nav onBack={prev} onNext={next} />
        </div>
      )}

      {user && step === 'broker' && (
        <div className="stage">
          {progress}
          <h1 className="q">증권사 계좌를 연결합니다</h1>
          <p className="hint">
            예수금과 보유 종목을 불러와서, 남은 돈을 어디에 나눠 담으면 좋을지 계산합니다. 지금은 가상의 새움증권 데모 계좌로만 연결되고 실제 계좌에는 접속하지 않습니다.
          </p>

          {!account && (
            <section className="consent">
              <h2>새움증권 (데모)</h2>
              <p className="muted">연결하면 아래 정보를 조회합니다. 매매나 이체는 하지 않습니다.</p>
              <ul>
                <li>예수금(바로 투자할 수 있는 현금)</li>
                <li>보유 종목, 수량, 평균 매입가</li>
              </ul>
              <label className="check">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>위 정보 조회에 동의합니다</span>
              </label>
              <button className="btn primary" disabled={!consent || connecting} onClick={connectBroker}>
                {connecting ? '연결하는 중' : '계좌 연결하기'}
              </button>
            </section>
          )}

          {account && accountSummary && (
            <section className="analysis">
              <h3>{account.brokerName} 계좌가 연결됐습니다</h3>
              <p className="muted">계좌 {account.accountNo}, 기준일 {account.fetchedAt} 종가로 평가했습니다.</p>
              <dl className="acct">
                <div><dt>예수금</dt><dd className="num">{krw(account.cash)}</dd></div>
                <div><dt>주식 평가금액</dt><dd className="num">{krw(accountSummary.totalValue)}</dd></div>
                <div>
                  <dt>평가손익</dt>
                  <dd className={`num ${accountSummary.totalPnl >= 0 ? 'up' : 'down'}`}>
                    {accountSummary.totalPnl >= 0 ? '+' : ''}{krw(accountSummary.totalPnl)}
                  </dd>
                </div>
              </dl>
              <ul className="wl">
                {accountSummary.rows.map((r) => (
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

              <div className="conn-block">
                <label className="field" style={{ marginTop: 0 }}>
                  <span className="conn-title">이번에 투자할 금액 (예수금 {krw(account.cash)} 이내)</span>
                  <MoneyInput value={budget} onChange={setBudget} />
                </label>
                {(budget < MIN_BUDGET || budget > account.cash) && (
                  <p className="error">{krw(MIN_BUDGET)} 이상, 예수금 이내로 입력해 주십시오.</p>
                )}
              </div>

              <div className="conn-block">
                <h4 className="conn-title">투자 성향</h4>
                <p className="muted">{accountSummary.basis} 다르면 바꿔 주십시오.</p>
                <div className="row" style={{ marginTop: 10 }}>
                  {RISK_ORDER.map((r) => (
                    <button key={r} className="pill" aria-pressed={risk === r} onClick={() => setRiskOverride(r)}>
                      {RISK_LABEL[r]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="conn-block">
                <h4 className="conn-title">투자 기간</h4>
                <div className="row">
                  {(['short', 'mid', 'long'] as Horizon[]).map((h) => (
                    <button key={h} className="pill" aria-pressed={horizon === h} onClick={() => setHorizon(h)}>
                      {HORIZON_LABEL[h]}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}
          <Nav
            onBack={prev}
            onNext={next}
            disabled={!account || !(budget >= MIN_BUDGET) || (account !== null && budget > account.cash)}
          />
        </div>
      )}

      {user && step === 'trades' && (
        <div className="stage">
          {progress}
          <h1 className="q">거래내역을 불러옵니다</h1>
          <p className="hint">
            파일은 이 브라우저 안에서만 읽고 서버로 보내지 않습니다. 지금은 '새움증권' 양식 CSV를 지원합니다. 첫 줄은 거래일자, 종목코드, 종목명, 매매구분, 수량, 체결단가, 수수료 순서입니다.
          </p>
          <div className="row">
            <input type="file" accept=".csv,text/csv" aria-label="거래내역 CSV 선택" onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={useSample}>샘플 파일로 체험</button>
            <a className="btn" href="/sample_trades.csv" download>샘플 내려받기</a>
          </div>
          {tradeError && <p role="alert" className="error" style={{ marginTop: 14 }}>{tradeError}</p>}
          {trades && (
            <section className="analysis">
              <h3>내 거래에서 읽은 내용</h3>
              <p className="muted">
                거래 {trades.tradeCount}건을 읽었습니다{trades.ignoredRows > 0 ? `. 읽지 못한 ${trades.ignoredRows}건은 제외했습니다` : ''}.
              </p>
              <div className="chips">
                {trades.holdings.map((h) => (
                  <span key={h.code} className="chip">{h.name} {h.qty}주, {data.sectors[h.sector]}</span>
                ))}
              </div>
              {trades.basis.map((b) => (
                <p key={b} className="muted">{b}</p>
              ))}
              <p style={{ margin: '16px 0 8px' }}>이 패턴으로 본 성향과 기간입니다. 다르면 바꿔 주십시오.</p>
              <div className="row">
                {RISK_ORDER.map((r) => (
                  <button key={r} className="pill" aria-pressed={risk === r} onClick={() => setRiskOverride(r)}>
                    {RISK_LABEL[r]}
                  </button>
                ))}
              </div>
              <div className="row" style={{ marginTop: 8 }}>
                {(['short', 'mid', 'long'] as Horizon[]).map((h) => (
                  <button key={h} className="pill" aria-pressed={horizon === h} onClick={() => setHorizon(h)}>
                    {HORIZON_LABEL[h]}
                  </button>
                ))}
              </div>
            </section>
          )}
          <Nav onBack={prev} onNext={next} disabled={!trades} />
        </div>
      )}

      {user && step === 'sectors' && (
        <div className="stage">
          {progress}
          <h1 className="q">관심 있는 분야가 있습니까?</h1>
          <p className="hint">원하는 만큼 고를 수 있습니다. 잘 모르겠으면 아래에서 해당되는 걸 고르거나 건너뛰어도 됩니다.</p>
          <div className="opts cols multi">
            {Object.entries(data.sectors).map(([id, name]) => (
              <button key={id} className="opt" aria-pressed={sectors.includes(id)} onClick={() => toggleSector(id)}>
                <span><b>{name}</b><small>{SECTOR_DESC[id]}</small></span>
              </button>
            ))}
          </div>
          <h2 className="q-sub">잘 모르겠다면, 해당되는 걸 골라 보십시오</h2>
          <div className="row">
            {DAILY_HINTS.map((h) => (
              <button key={h.label} className="pill" aria-pressed={h.sectors.every((s) => sectors.includes(s))} onClick={() => toggleHint(h.sectors)}>
                {h.label}
              </button>
            ))}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="pill" aria-pressed={sectors.length === 0} onClick={() => setSectors([])}>
              잘 모르겠습니다. 여러 업종에서 골라 주십시오
            </button>
          </div>
          <Nav onBack={prev} onNext={next} nextLabel="추천 받기" />
        </div>
      )}

      {user && step === 'result' && result && (
        <Result
          data={data}
          profile={profile}
          result={result}
          portfolio={usesPortfolio ? portfolio : []}
          cash={method === 'broker' ? cash : null}
          initialTab={welcomeName && usesPortfolio && portfolio.length > 0 ? 'account' : 'recommend'}
          onAccountConnected={connectAccount}
          onChangeConditions={changeConditions}
          minBudget={MIN_BUDGET}
          userEmail={user.email}
          onRestart={restart}
          onBack={() => setStep('sectors')}
        />
      )}
    </div>
  )
}

function Nav({ onBack, onNext, disabled, nextLabel = '다음' }: { onBack: () => void; onNext: () => void; disabled?: boolean; nextLabel?: string }) {
  return (
    <div className="nav">
      <button className="link" onClick={onBack}>이전</button>
      <button className="btn primary" onClick={onNext} disabled={disabled}>{nextLabel}</button>
    </div>
  )
}
