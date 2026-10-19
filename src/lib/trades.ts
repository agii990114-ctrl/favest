import type { Dataset, Horizon, Risk } from './types'
import { computeMetrics, riskFromRank } from './engine'

/**
 * 지원 양식(페르소나): '새움증권' 거래내역 CSV
 * 헤더: 거래일자,종목코드,종목명,매매구분,수량,체결단가,수수료
 * 다른 증권사 양식은 PARSERS에 파서를 추가해 확장한다.
 */
export interface Trade {
  date: string
  code: string
  name: string
  side: 'buy' | 'sell'
  qty: number
  price: number
  fee: number
}

export interface TradeSummary {
  tradeCount: number
  ignoredRows: number
  holdings: { code: string; name: string; sector: string; qty: number; avgPrice: number }[]
  sectorShare: Record<string, number>
  avgHoldingDays: number | null
  inferredRisk: Risk
  inferredHorizon: Horizon
  basis: string[]
}

function parseSaeumCsv(text: string): { trades: Trade[]; ignored: number } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim())
  const header = lines[0]?.split(',').map((h) => h.trim()) ?? []
  const idx = (name: string) => header.indexOf(name)
  const col = {
    date: idx('거래일자'),
    code: idx('종목코드'),
    name: idx('종목명'),
    side: idx('매매구분'),
    qty: idx('수량'),
    price: idx('체결단가'),
    fee: idx('수수료'),
  }
  if (Object.values(col).some((i) => i < 0)) {
    throw new Error(
      '지원하지 않는 양식입니다. 헤더가 "거래일자,종목코드,종목명,매매구분,수량,체결단가,수수료"인 CSV만 읽을 수 있습니다.',
    )
  }
  const trades: Trade[] = []
  let ignored = 0
  for (const line of lines.slice(1)) {
    const c = line.split(',').map((x) => x.trim())
    const side = c[col.side] === '매수' ? 'buy' : c[col.side] === '매도' ? 'sell' : null
    const qty = Number(c[col.qty])
    const price = Number(c[col.price])
    if (!side || !(qty > 0) || !(price > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(c[col.date])) {
      ignored += 1
      continue
    }
    trades.push({
      date: c[col.date],
      code: c[col.code].padStart(6, '0'),
      name: c[col.name],
      side,
      qty,
      price,
      fee: Number(c[col.fee]) || 0,
    })
  }
  return { trades, ignored }
}

/** 증권사 양식별 파서 목록 (현재는 1개) */
const PARSERS = [parseSaeumCsv]

const dayDiff = (a: string, b: string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)

export function summarizeTrades(text: string, data: Dataset): TradeSummary {
  let parsed: { trades: Trade[]; ignored: number } | null = null
  let lastError: unknown
  for (const parse of PARSERS) {
    try {
      parsed = parse(text)
      break
    } catch (e) {
      lastError = e
    }
  }
  if (!parsed) throw lastError instanceof Error ? lastError : new Error('파일을 읽지 못했습니다.')

  const byCode = new Map(data.stocks.map((s) => [s.code, s]))
  const known = parsed.trades.filter((t) => byCode.has(t.code))
  const ignoredRows = parsed.ignored + (parsed.trades.length - known.length)
  if (known.length === 0) throw new Error('이 서비스의 종목 목록과 일치하는 거래가 없습니다.')

  known.sort((a, b) => a.date.localeCompare(b.date))

  // FIFO로 매수-매도를 맞춰 보유 기간을 계산하고, 남은 수량을 보유 종목으로 본다.
  const lots = new Map<string, { date: string; qty: number; price: number }[]>()
  const heldDays: number[] = []
  for (const t of known) {
    const q = lots.get(t.code) ?? []
    if (t.side === 'buy') {
      q.push({ date: t.date, qty: t.qty, price: t.price })
    } else {
      let remain = t.qty
      while (remain > 0 && q.length > 0) {
        const lot = q[0]
        const used = Math.min(lot.qty, remain)
        heldDays.push(dayDiff(lot.date, t.date))
        lot.qty -= used
        remain -= used
        if (lot.qty === 0) q.shift()
      }
    }
    lots.set(t.code, q)
  }

  const holdings = [...lots.entries()]
    .map(([code, q]) => {
      const qty = q.reduce((s, l) => s + l.qty, 0)
      // 남은 묶음 기준 가중 평균 매입가
      const avgPrice = qty ? Math.round(q.reduce((s, l) => s + l.qty * l.price, 0) / qty) : 0
      return { code, qty, avgPrice }
    })
    .filter((h) => h.qty > 0)
    .map((h) => {
      const s = byCode.get(h.code)!
      return { code: h.code, name: s.name, sector: s.sector, qty: h.qty, avgPrice: h.avgPrice }
    })

  // 보유 중인 lot의 경과 일수도 보유 기간에 반영
  const openDays = [...lots.values()].flatMap((q) => q.map((l) => dayDiff(l.date, data.asOf)))
  const allDays = [...heldDays, ...openDays]
  const avgHoldingDays = allDays.length ? allDays.reduce((s, v) => s + v, 0) / allDays.length : null

  // 거래한 종목의 변동성이 전체 종목 중 어디쯤인지로 성향을 추정
  const allVol = data.stocks.map((s) => computeMetrics(s).vol)
  const tradedCodes = [...new Set(known.map((t) => t.code))]
  const volRanks = tradedCodes.map((code) => {
    const v = computeMetrics(byCode.get(code)!).vol
    return allVol.filter((x) => x < v).length / (allVol.length - 1)
  })
  const avgRank = volRanks.reduce((s, v) => s + v, 0) / volRanks.length
  const inferredRisk: Risk = riskFromRank(avgRank)
  const inferredHorizon: Horizon =
    avgHoldingDays == null || avgHoldingDays >= 180 ? 'long' : avgHoldingDays < 45 ? 'short' : 'mid'

  const sectorQty: Record<string, number> = {}
  for (const h of holdings) {
    const price = computeMetrics(byCode.get(h.code)!).price
    sectorQty[h.sector] = (sectorQty[h.sector] ?? 0) + h.qty * price
  }
  const totalValue = Object.values(sectorQty).reduce((s, v) => s + v, 0)
  const sectorShare: Record<string, number> = {}
  for (const [k, v] of Object.entries(sectorQty)) sectorShare[k] = totalValue ? v / totalValue : 0

  const basis = [
    `거래한 종목의 변동성이 전체 종목 중 평균 ${(avgRank * 100).toFixed(0)}% 위치입니다.`,
    avgHoldingDays != null
      ? `평균 보유 기간은 약 ${Math.round(avgHoldingDays)}일입니다.`
      : '보유 기간을 계산할 수 없어 장기로 가정했습니다.',
  ]

  return {
    tradeCount: known.length,
    ignoredRows,
    holdings,
    sectorShare,
    avgHoldingDays,
    inferredRisk,
    inferredHorizon,
    basis,
  }
}
