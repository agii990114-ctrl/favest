import { useState, type FormEvent } from 'react'
import { logIn, signUp, type SessionUser } from '../lib/auth'
import type { Stock } from '../lib/types'
import PriceChart from './PriceChart'

interface Props {
  onAuthed: (user: SessionUser) => void
  sample: Stock
}

export default function Auth({ onAuthed, sample }: Props) {
  const [tab, setTab] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  function switchTab(next: 'login' | 'signup') {
    setTab(next)
    setError('')
    setNotice('')
    setPassword('')
    setConfirm('')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    if (tab === 'signup' && password !== confirm) {
      setError('비밀번호가 서로 다릅니다.')
      return
    }
    setBusy(true)
    try {
      if (tab === 'signup') {
        const res = await signUp(email, password, nickname)
        if (!res.ok) {
          setError(res.error)
          return
        }
        // 가입 후에는 로그인 화면으로 보내 직접 로그인하게 한다.
        setTab('login')
        setPassword('')
        setConfirm('')
        setNotice('가입이 완료되었습니다. 로그인해 주십시오.')
      } else {
        const res = await logIn(email, password)
        if (!res.ok) {
          setError(res.error)
          return
        }
        onAuthed(res.user)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-intro">
        <h1>고른 종목마다 근거를 같이 보여드립니다</h1>
        <p className="lead">
          예산과 투자 성향을 알려 주시면, 최근 가격과 거래량을 기준으로 종목을 고르고 왜 골랐는지 숫자로 설명합니다.
        </p>
        <div className="auth-chart">
          <PriceChart dates={sample.dates} close={sample.close} volume={sample.volume} label={`${sample.name} 최근 6개월 가격과 거래량`} />
        </div>
      </div>

      <div className="auth-form">
        <div className="tabs" role="tablist" aria-label="로그인 또는 회원가입">
          <button role="tab" aria-selected={tab === 'login'} onClick={() => switchTab('login')}>
            로그인
          </button>
          <button role="tab" aria-selected={tab === 'signup'} onClick={() => switchTab('signup')}>
            회원가입
          </button>
        </div>


        <form onSubmit={submit} noValidate>
          <label className="field">
            <span>이메일</span>
            <input type="text" inputMode="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          {tab === 'signup' && (
            <label className="field">
              <span>닉네임 (선택)</span>
              <input type="text" autoComplete="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} />
            </label>
          )}
          <label className="field">
            <span>비밀번호{tab === 'signup' ? ' (영문과 숫자 포함 8자 이상)' : ''}</span>
            <input
              type="password"
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {tab === 'signup' && (
            <label className="field">
              <span>비밀번호 확인</span>
              <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </label>
          )}

          {notice && <p role="status" className="ok" style={{ marginBottom: 14 }}>{notice}</p>}
          {error && <p role="alert" className="error" style={{ marginBottom: 14 }}>{error}</p>}

          <button className="btn primary block" type="submit" disabled={busy || !email || !password}>
            {busy ? '처리 중' : tab === 'login' ? '로그인' : '가입하기'}
          </button>
        </form>
      </div>
    </div>
  )
}
