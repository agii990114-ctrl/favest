import { useState } from 'react'

interface Article {
  title: string
  source: string
  url: string
  pubDate: string
}
interface NewsResponse {
  mode: 'live' | 'link'
  articles: Article[]
  summary: string | null
  searchUrl: string
  notice?: string
}

const searchLink = (name: string) =>
  `https://search.naver.com/search.naver?where=news&sort=1&query=${encodeURIComponent(name)}`

const fmtDate = (s: string) => {
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ko-KR')
}

export default function NewsPanel({ name }: { name: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [data, setData] = useState<NewsResponse | null>(null)

  async function load() {
    setState('loading')
    try {
      const res = await fetch(`/api/news?name=${encodeURIComponent(name)}`)
      if (!res.ok) throw new Error(String(res.status))
      const body = (await res.json()) as NewsResponse
      if (!Array.isArray(body.articles)) throw new Error('bad-body')
      setData(body)
    } catch {
      setData({
        mode: 'link',
        articles: [],
        summary: null,
        searchUrl: searchLink(name),
        notice: '뉴스를 불러오지 못해 검색 링크로 대신합니다.',
      })
    }
    setState('done')
  }

  if (state === 'idle') {
    return (
      <div className="news">
        <button className="btn" onClick={load}>관련 뉴스 보기</button>
      </div>
    )
  }
  if (state === 'loading') {
    return <div className="news muted">뉴스를 모으는 중입니다…</div>
  }
  return (
    <div className="news">
      {data?.notice && <p className="muted">{data.notice}</p>}
      {data?.summary && (
        <>
          <div className="summary">{data.summary}</div>
          <p className="muted">AI(Gemini)가 기사 제목을 요약한 내용이며 부정확할 수 있습니다. 투자 판단의 근거로 쓰지 마십시오.</p>
        </>
      )}
      {data && data.articles.length > 0 && (
        <ul>
          {data.articles.map((a) => (
            <li key={a.url}>
              <a href={a.url} target="_blank" rel="noopener noreferrer">
                {a.title}
              </a>{' '}
              <span className="muted">
                {a.source} {fmtDate(a.pubDate)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <a href={data?.searchUrl || searchLink(name)} target="_blank" rel="noopener noreferrer">
        네이버 뉴스에서 더 보기
      </a>
    </div>
  )
}
