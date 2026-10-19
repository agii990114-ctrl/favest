/** 관심 종목은 계정별로 이 브라우저(localStorage)에 저장한다. */
const key = (email: string) => `jg_watch_${email}`

export function loadWatch(email: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key(email)) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function saveWatch(email: string, codes: string[]) {
  try {
    localStorage.setItem(key(email), JSON.stringify(codes))
  } catch {
    /* 저장 실패해도 이번 방문 동안은 동작한다 */
  }
}
