import type { Horizon, Risk } from './types'

/**
 * 투자성향 진단(증권사 투자성향 설문 구조를 참고한 과제용 문항).
 * 문항마다 선택지 점수(0~5)를 더해 0~100점으로 환산하고 5단계로 나눈다. 구간과 점수는 과제용 가정이다.
 */
export interface QOption {
  label: string
  score: number
  desc?: string
  horizon?: Horizon
}

export interface Question {
  id: string
  text: string
  help?: string
  /** 여러 개 고를 수 있는 문항(점수는 고른 것 중 가장 높은 값) */
  multi?: boolean
  /** 선택지를 2열로 놓을 문항 */
  cols?: boolean
  options: QOption[]
}

/** 문항 id → 고른 선택지 번호 목록. null은 '잘 모르겠습니다' */
export type Answers = Record<string, number[] | null>

export const QUESTIONS: Question[] = [
  {
    id: 'age',
    text: '연령대를 알려 주십시오.',
    cols: true,
    options: [
      { label: '만 19세 이하', score: 4 },
      { label: '만 20세~40세', score: 5 },
      { label: '만 41세~50세', score: 4 },
      { label: '만 51세~60세', score: 3 },
      { label: '만 61세 이상', score: 1 },
    ],
  },
  {
    id: 'income',
    text: '월 소득은 어느 정도입니까?',
    options: [
      { label: '100만원 미만', score: 1 },
      { label: '100만원 ~ 200만원', score: 2 },
      { label: '200만원 ~ 300만원', score: 3 },
      { label: '300만원 ~ 500만원', score: 4 },
      { label: '500만원 초과', score: 5 },
    ],
  },
  {
    id: 'purpose',
    text: '투자하는 목적은 무엇입니까?',
    options: [
      { label: '생계(단기)자금 운용', score: 1 },
      { label: '예·적금 정도의 수익 실현', score: 2 },
      { label: '시장(주가지수) 변동보다 높은 수익 실현', score: 4 },
      { label: '적극적인 투자를 통한 보유자산 증식', score: 5 },
    ],
  },
  {
    id: 'share',
    text: '전체 금융자산 중 투자성 자산의 비중은 어느 정도입니까?',
    help: '투자성 자산은 주식, 펀드, 채권처럼 원금 손실 가능성이 있는 자산입니다.',
    cols: true,
    options: [
      { label: '10% 이하', score: 1 },
      { label: '30% 이하', score: 2 },
      { label: '50% 이하', score: 3 },
      { label: '70% 이하', score: 4 },
      { label: '70% 초과', score: 5 },
    ],
  },
  {
    id: 'exp',
    text: '투자해 본 적이 있는 금융상품을 모두 골라 주십시오.',
    multi: true,
    options: [
      { label: '투자 경험 없음', score: 1 },
      { label: '안정형 상품', score: 1, desc: '은행 예·적금, MMF, CMA, 국고채 등' },
      { label: '안정추구형 상품', score: 2, desc: '채권형 펀드, 원금지급형 ELB, 신용등급이 높은 채권 등' },
      { label: '위험중립형 상품', score: 3, desc: '채권혼합형 펀드, 원금부분보장형 ELS 등' },
      { label: '적극투자형 상품', score: 4, desc: '주식, 주식형 펀드, 원금비보장형 ELS 등' },
      { label: '공격투자형 상품', score: 5, desc: '해외주식, 선물옵션, ELW, 신용거래 등' },
    ],
  },
  {
    id: 'loss',
    text: '감내할 수 있는 손실 수준은 어느 정도입니까?',
    help: '"원금 손실은 원하지 않습니다"를 고르면 안정형으로 분류합니다.',
    options: [
      { label: '원금 손실은 원하지 않습니다', score: 0 },
      { label: '원금의 10%까지 손실 감내 가능', score: 1 },
      { label: '원금의 20%까지 손실 감내 가능', score: 2 },
      { label: '원금의 50%까지 손실 감내 가능', score: 3 },
      { label: '원금의 70%까지 손실 감내 가능', score: 4 },
      { label: '원금 전액 손실 감내 가능', score: 5 },
    ],
  },
  {
    id: 'period',
    text: '투자 예정 기간은 어느 정도입니까?',
    help: '이 답이 추천의 투자 기간(단기·중기·장기)으로 쓰입니다.',
    options: [
      { label: '6개월 미만', score: 1, horizon: 'short' },
      { label: '6개월 이상 ~ 1년 미만', score: 2, horizon: 'short' },
      { label: '1년 이상 ~ 2년 미만', score: 3, horizon: 'mid' },
      { label: '2년 이상 ~ 3년 미만', score: 4, horizon: 'mid' },
      { label: '3년 이상', score: 5, horizon: 'long' },
    ],
  },
]

export const DEFAULT_SCORE = 3

export interface QuizResult {
  risk: Risk
  /** 0~100점 */
  score: number
  /** 투자 예정 기간 문항의 답(모르면 null) */
  horizon: Horizon | null
  basis: string
  usedDefaults: number
  answeredCount: number
}

const scoreOf = (q: Question, picked: number[]) => Math.max(...picked.map((i) => q.options[i].score))

export function classify(answers: Answers): QuizResult {
  let usedDefaults = 0
  let answeredCount = 0
  let sum = 0
  const notes: { text: string; score: number }[] = []
  for (const q of QUESTIONS) {
    const a = answers[q.id]
    if (a === undefined) {
      sum += DEFAULT_SCORE
      continue
    }
    answeredCount += 1
    if (a === null || a.length === 0) {
      usedDefaults += 1
      sum += DEFAULT_SCORE
      continue
    }
    const sc = scoreOf(q, a)
    sum += sc
    notes.push({ text: q.options[a[0]].label, score: sc })
  }
  const min = QUESTIONS.length * 1
  const max = QUESTIONS.length * 5
  const score = Math.round(Math.min(100, Math.max(0, ((sum - min) / (max - min)) * 100)))
  let risk: Risk = score < 20 ? 'stable' : score < 40 ? 'stablePlus' : score < 60 ? 'neutral' : score < 80 ? 'active' : 'aggressive'

  const noLoss = answers.loss?.includes(0) ?? false
  if (noLoss) risk = 'stable'

  const periodPick = answers.period
  const horizon = periodPick && periodPick.length ? (QUESTIONS.find((q) => q.id === 'period')!.options[periodPick[0]].horizon ?? null) : null

  let basis = `진단 점수는 100점 중 ${score}점입니다.`
  if (noLoss) basis += ' 원금 손실을 원하지 않는다고 답해 안정형으로 분류했습니다.'
  else {
    const low = [...notes].sort((a, b) => a.score - b.score)[0]
    const high = [...notes].sort((a, b) => b.score - a.score)[0]
    if (low && low.score <= 1) basis += ` '${low.text}'를 골라 위험을 낮게 반영했습니다.`
    if (high && high.score >= 5) basis += ` '${high.text}'를 골라 위험을 높게 반영했습니다.`
  }
  if (usedDefaults > 0) basis += ` 잘 모르겠다고 답한 ${usedDefaults}문항은 중간 점수로 계산했습니다.`
  return { risk, score, horizon, basis, usedDefaults, answeredCount }
}

/** 상품 위험등급 6단계(1등급이 가장 위험) */
export const GRADE_LABEL = ['매우높은위험', '높은위험', '다소높은위험', '보통위험', '낮은위험', '매우낮은위험'] as const

/**
 * 성향별 설명과 권유 가능한 가장 위험한 등급(과제용 예시 기준, 증권사마다 다를 수 있음).
 * 예: maxGrade 4 → 보통위험(4등급) 이하 상품 권유 가능
 */
export const RISK_INFO: Record<Risk, { desc: string; maxGrade: number }> = {
  stable: { desc: '원금 손실을 최소화하고 예금 수준의 수익을 기대하는 성향입니다.', maxGrade: 6 },
  stablePlus: { desc: '원금 손실 위험을 낮게 유지하면서 예금보다 조금 높은 수익을 기대하는 성향입니다.', maxGrade: 5 },
  neutral: { desc: '예금보다 높은 수익을 위해 일정 수준의 손실을 감수할 수 있는 성향입니다.', maxGrade: 4 },
  active: { desc: '원금 보전보다 높은 수익을 추구하며 상당한 손실도 감수할 수 있는 성향입니다.', maxGrade: 2 },
  aggressive: { desc: '시장 평균을 넘는 높은 수익을 위해 큰 손실도 적극적으로 감수하는 성향입니다.', maxGrade: 1 },
}

/** 개별 주식은 높은위험(2등급) 이상으로 분류한다고 가정한다(과제용 예시). */
export const STOCK_GRADE = 2
export const stockSuitable = (risk: Risk) => RISK_INFO[risk].maxGrade <= STOCK_GRADE

export const HORIZON_OPTIONS: { value: Horizon; label: string; desc: string }[] = [
  { value: 'short', label: '6개월 이내', desc: '단기: 최근 흐름과 거래량을 더 봅니다' },
  { value: 'mid', label: '1~2년', desc: '중기: 균형 있게 봅니다' },
  { value: 'long', label: '3년 이상', desc: '장기: 꾸준한 추세와 안정성을 더 봅니다' },
]

/** 관심 분야를 모르는 사람을 위한 일상 질문 → 섹터 연결 */
export const DAILY_HINTS: { label: string; sectors: string[] }[] = [
  { label: '스마트폰·AI·전자기기에 관심이 많습니다', sectors: ['semiconductor'] },
  { label: '전기차·친환경 에너지에 관심이 있습니다', sectors: ['battery', 'auto'] },
  { label: '건강·의료 분야에 관심이 있습니다', sectors: ['bio'] },
  { label: '카톡·네이버를 매일 씁니다', sectors: ['platform'] },
  { label: '게임·K-팝을 즐깁니다', sectors: ['game'] },
  { label: '화장품·식품·쇼핑을 자주 합니다', sectors: ['consumer'] },
  { label: '은행·보험이 익숙합니다', sectors: ['finance'] },
]
