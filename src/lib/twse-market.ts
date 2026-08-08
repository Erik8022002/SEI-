import type { Company } from '@/data'

export type TwseMarketSnapshotData = {
  ticker: string
  available: boolean
  reason?: string
  name?: string
  date?: string
  fetchedAt?: string
  source?: string
  sourceUrl?: string
  market?: {
    open: number | null
    high: number | null
    low: number | null
    close: number | null
    change: number | null
    changePercent: number | null
    tradeVolume: number | null
    tradeValue: number | null
    transactions: number | null
  }
  valuation?: {
    peRatio: number | null
    dividendYield: number | null
    pbRatio: number | null
  }
}

type TwseRawRow = Record<string, string | undefined>

function toNumber(value: unknown) {
  const normalized = String(value ?? '').replace(/,/g, '').trim()
  if (!normalized || normalized === '--' || normalized === 'N/A') return null
  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

function formatRocDate(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.length !== 7) return String(value ?? '')
  return `${Number(digits.slice(0, 3)) + 1911}-${digits.slice(3, 5)}-${digits.slice(5, 7)}`
}

function buildDevSnapshot(ticker: string, tradeRow?: TwseRawRow, valuationRow?: TwseRawRow): TwseMarketSnapshotData {
  if (!tradeRow && !valuationRow) {
    return { ticker, available: false, reason: 'TWSE 查無此上市股票的每日市場資料' }
  }

  const close = toNumber(tradeRow?.ClosingPrice)
  const change = toNumber(tradeRow?.Change)
  const previousClose = close !== null && change !== null ? close - change : null

  return {
    ticker,
    available: true,
    name: tradeRow?.Name || valuationRow?.Name,
    date: formatRocDate(tradeRow?.Date || valuationRow?.Date),
    fetchedAt: new Date().toISOString(),
    source: 'Taiwan Stock Exchange OpenAPI',
    sourceUrl: 'https://openapi.twse.com.tw/',
    market: {
      open: toNumber(tradeRow?.OpeningPrice),
      high: toNumber(tradeRow?.HighestPrice),
      low: toNumber(tradeRow?.LowestPrice),
      close,
      change,
      changePercent: previousClose && change !== null ? (change / previousClose) * 100 : null,
      tradeVolume: toNumber(tradeRow?.TradeVolume),
      tradeValue: toNumber(tradeRow?.TradeValue),
      transactions: toNumber(tradeRow?.Transaction),
    },
    valuation: {
      peRatio: toNumber(valuationRow?.PEratio),
      dividendYield: toNumber(valuationRow?.DividendYield),
      pbRatio: toNumber(valuationRow?.PBratio),
    },
  }
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', signal })
  if (!response.ok) throw new Error(`資料同步失敗：${response.status}`)
  return response.json() as Promise<T>
}

export async function fetchTwseMarketSnapshot(company: Company, signal: AbortSignal) {
  if (company.market !== '上市') {
    return {
      ticker: company.ticker,
      available: false,
      reason: 'TWSE OpenAPI 僅提供上市市場資料',
      source: 'Taiwan Stock Exchange OpenAPI',
      sourceUrl: 'https://openapi.twse.com.tw/',
    } satisfies TwseMarketSnapshotData
  }

  if (import.meta.env.DEV) {
    const [tradeRows, valuationRows] = await Promise.all([
      fetchJson<TwseRawRow[]>('/twse-openapi/v1/exchangeReport/STOCK_DAY_ALL', signal),
      fetchJson<TwseRawRow[]>('/twse-openapi/v1/exchangeReport/BWIBBU_ALL', signal),
    ])
    const tradeRow = tradeRows.find((row) => String(row.Code ?? '').trim() === company.ticker)
    const valuationRow = valuationRows.find((row) => String(row.Code ?? '').trim() === company.ticker)
    return buildDevSnapshot(company.ticker, tradeRow, valuationRow)
  }

  const params = new URLSearchParams({ ticker: company.ticker, market: company.market })
  return fetchJson<TwseMarketSnapshotData>(`/api/twse-market?${params}`, signal)
}
