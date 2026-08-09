import type { Company, HistoricalEvent } from '@/data'

type TwseHistoricalNewsResponse = {
  code: number
  message: string
  result?: {
    marketName?: string
    companyId?: string
    companyAbbreviation?: string
    data?: unknown[]
    titles?: Array<{ main?: string }>
  }
  error?: string
}

type TwseHistoricalNewsRow = [string, string, string, string, string, unknown?]

const MOPS_HISTORICAL_NEWS_URL = 'https://mops.twse.com.tw/mops/api/t05st01'

function cleanText(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function formatRocDate(value: unknown) {
  const text = cleanText(value)
  const match = text.match(/^(\d{2,3})\/(\d{1,2})\/(\d{1,2})$/)
  if (!match) return text
  const year = Number(match[1]) + 1911
  return `${year}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
}

function classifyCategory(title: string): HistoricalEvent['category'] {
  if (/董事會|股東會|財務報告|股利|減資|增資|內控|改選|審計委員會|召開/.test(title)) return '公司治理'
  if (/合作|座談會|簽約|通路|市場|媒體|直播|供應|訂單/.test(title)) return '市場合作'
  if (/投資|募資|子公司|設廠|併購|取得|處分|開發|建置|債券|資本公積|資產/.test(title)) return '技術投資'
  return '營運發展'
}

function toHistoricalEvent(row: TwseHistoricalNewsRow): HistoricalEvent | null {
  const date = formatRocDate(row[2])
  const title = cleanText(row[4])
  if (!date || !title) return null

  return {
    date,
    category: classifyCategory(title),
    title,
    summary: title,
  }
}

function mergeHistoricalEvents(official: HistoricalEvent[], fallback: HistoricalEvent[]) {
  const seen = new Set<string>()
  return [...official, ...fallback]
    .filter((event) => {
      const key = `${event.date}-${event.title}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.title.localeCompare(a.title))
}

export type TwseHistoricalEventsPayload = {
  companyId: string
  market: string
  fetchedAt: string
  source: string
  events: HistoricalEvent[]
}

async function fetchHistoricalYear(companyId: string, year: string, signal: AbortSignal) {
  const response = await fetch(MOPS_HISTORICAL_NEWS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
    },
    body: JSON.stringify({
      companyId,
      year,
      month: 'all',
      firstDay: '',
      lastDay: '',
    }),
    signal,
  })

  if (!response.ok) throw new Error(`MOPS 歷史重大訊息查詢失敗：${response.status}`)
  const payload = await response.json() as TwseHistoricalNewsResponse
  const rows = payload?.result?.data
  if (!Array.isArray(rows)) return []
  return rows
    .map((row) => toHistoricalEvent(row as TwseHistoricalNewsRow))
    .filter((event): event is HistoricalEvent => event !== null)
}

export async function fetchTwseHistoricalEvents(company: Company, signal: AbortSignal) {
  const currentYear = new Date().getFullYear() - 1911
  const years = Array.from({ length: 20 }, (_, index) => String(currentYear - index))
  const settled = await Promise.allSettled(years.map((year) => fetchHistoricalYear(company.ticker, year, signal)))
  const events = mergeHistoricalEvents(
    settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])),
    [],
  )

  return {
    companyId: company.ticker,
    market: company.market,
    fetchedAt: new Date().toISOString(),
    source: '公開資訊觀測站－歷史重大訊息',
    events,
  } satisfies TwseHistoricalEventsPayload
}

export function mergeTwseHistoricalEvents(official: HistoricalEvent[], fallback: HistoricalEvent[]) {
  return mergeHistoricalEvents(official, fallback)
}
