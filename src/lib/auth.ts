/**
 * 프로토타입용 계정 처리. 백엔드가 없어서 계정 정보는 이 브라우저(localStorage)에만 저장된다.
 * 비밀번호는 솔트 + PBKDF2로 해시해 저장하지만, 실서비스용 인증이 아니다(서버 검증·세션 보안 없음).
 */
import type { Horizon, Risk } from './types'

export interface Holding {
  code: string
  qty: number
  /** 평균 매입가(알 수 있을 때만) */
  avgPrice?: number
}

export interface SavedSetup {
  experience: 'new' | 'existing'
  method: 'quiz' | 'file' | 'manual' | 'broker'
  budget: number
  risk: Risk
  horizon: Horizon
  sectors: string[]
  holdings: string[]
  portfolio?: Holding[]
  /** 계좌 연결로 알게 된 예수금 */
  cash?: number
}

interface UserRecord {
  salt: string
  hash: string
  nickname: string
  createdAt: string
  setup?: SavedSetup
}

export interface SessionUser {
  email: string
  nickname: string
}

const USERS_KEY = 'jg_users'
const SESSION_KEY = 'jg_session'

function readUsers(): Record<string, UserRecord> {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? '{}') as Record<string, UserRecord>
  } catch {
    return {}
  }
}

function writeUsers(users: Record<string, UserRecord>): boolean {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users))
    return true
  } catch {
    return false
  }
}

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)))

async function derive(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: 100_000 },
    key,
    256,
  )
  return b64(bits)
}

const normalize = (email: string) => email.trim().toLowerCase()
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type AuthResult = { ok: true; user: SessionUser } | { ok: false; error: string }

export async function signUp(email: string, password: string, nickname: string): Promise<AuthResult> {
  const id = normalize(email)
  if (!EMAIL_RE.test(id)) return { ok: false, error: '이메일 형식이 올바르지 않습니다.' }
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return { ok: false, error: '비밀번호는 영문과 숫자를 포함해 8자 이상이어야 합니다.' }
  }
  const users = readUsers()
  if (users[id]) return { ok: false, error: '이미 가입된 이메일입니다. 로그인해 주십시오.' }

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const name = nickname.trim() || id.split('@')[0]
  users[id] = { salt: b64(salt), hash: await derive(password, salt), nickname: name, createdAt: new Date().toISOString() }
  if (!writeUsers(users)) return { ok: false, error: '브라우저 저장소를 사용할 수 없어 가입하지 못했습니다.' }
  return { ok: true, user: { email: id, nickname: name } }
}

export async function logIn(email: string, password: string): Promise<AuthResult> {
  const id = normalize(email)
  const rec = readUsers()[id]
  const fail = { ok: false as const, error: '이메일 또는 비밀번호가 맞지 않습니다.' }
  if (!rec) return fail
  const salt = Uint8Array.from(atob(rec.salt), (c) => c.charCodeAt(0))
  if ((await derive(password, salt)) !== rec.hash) return fail
  const user = { email: id, nickname: rec.nickname }
  try {
    localStorage.setItem(SESSION_KEY, id)
  } catch {
    /* 저장 실패해도 이번 방문 동안은 로그인 상태로 둔다 */
  }
  return { ok: true, user }
}

export function currentUser(): SessionUser | null {
  try {
    const id = localStorage.getItem(SESSION_KEY)
    const rec = id ? readUsers()[id] : undefined
    return id && rec ? { email: id, nickname: rec.nickname } : null
  } catch {
    return null
  }
}

export function logOut() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* 무시 */
  }
}

export function loadSetup(email: string): SavedSetup | null {
  return readUsers()[email]?.setup ?? null
}

export function saveSetup(email: string, setup: SavedSetup) {
  const users = readUsers()
  if (!users[email]) return
  users[email].setup = setup
  writeUsers(users)
}
