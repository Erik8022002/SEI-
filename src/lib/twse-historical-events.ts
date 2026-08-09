import type { Company, Event as MaterialEvent, HistoricalEvent } from '@/data'

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

type EventSet = {
  companyId: string
  market: string
  fetchedAt: string
  source: string
  allEvents: HistoricalEvent[]
  recentEvents: MaterialEvent[]
  historicalEvents: HistoricalEvent[]
}

const MOPS_HISTORICAL_NEWS_URL = 'https://mops.twse.com.tw/mops/api/t05st01'
const RECENT_EVENT_LOOKBACK_DAYS = 14
const RECENT_EVENT_LIMIT = 20
const EVENT_CACHE_MS = 4 * 60 * 60 * 1000 - 60 * 1000

const eventCache = new Map<string, { storedAt: number; data: EventSet }>()
const inflightRequests = new Map<string, Promise<EventSet>>()

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

function classifyImpact(title: string): MaterialEvent['impact'] {
  if (/損失|虧損|違約|訴訟|裁罰|停工|災害|資安|下修|終止|解任/.test(title)) return '留意'
  if (/營收.*成長|獲利|取得.*訂單|簽署.*合作|擴產|增產|創新高|上修/.test(title)) return '正向'
  return '中性'
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

function mergeHistoricalEventsRaw(official: HistoricalEvent[], fallback: HistoricalEvent[]) {
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

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function splitRecentEvents(events: HistoricalEvent[]) {
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - (RECENT_EVENT_LOOKBACK_DAYS - 1))
  const cutoffKey = formatDateKey(cutoff)

  const recentHistorical = events
    .filter((event) => event.date >= cutoffKey)
    .slice(0, RECENT_EVENT_LIMIT)

  const recentEvents: MaterialEvent[] = recentHistorical.map((event) => ({
    ...event,
    impact: classifyImpact(event.title),
  }))

  const historicalEvents = events.filter((event) => event.date < cutoffKey)

  return { recentEvents, historicalEvents }
}

export type TwseHistoricalEventsPayload = {
  companyId: string
  market: string
  fetchedAt: string
  source: string
  events: HistoricalEvent[]
}

async function fetchHistoricalYear(companyId: string, year: string) {
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
  })

  if (!response.ok) throw new Error(`MOPS 歷史重大訊息查詢失敗：${response.status}`)
  const payload = await response.json() as TwseHistoricalNewsResponse
  const rows = payload?.result?.data
  if (!Array.isArray(rows)) return []
  return rows
    .map((row) => toHistoricalEvent(row as TwseHistoricalNewsRow))
    .filter((event): event is HistoricalEvent => event !== null)
}

async function loadEventSet(companyId: string, market: string) {
  const cacheKey = `${market}:${companyId}`
  const cached = eventCache.get(cacheKey)
  if (cached && Date.now() - cached.storedAt < EVENT_CACHE_MS) return cached.data

  const inflight = inflightRequests.get(cacheKey)
  if (inflight) return inflight

  const request = (async () => {
    const currentYear = new Date().getFullYear() - 1911
    const years = Array.from({ length: 20 }, (_, index) => String(currentYear - index))
    const settled = await Promise.allSettled(years.map((year) => fetchHistoricalYear(companyId, year)))
    const allEvents = mergeHistoricalEventsRaw(
      settled.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])),
      [],
    )

    if (allEvents.length === 0 && settled.every((result) => result.status === 'rejected')) {
      const firstFailure = settled.find((result) => result.status === 'rejected')
      throw firstFailure && firstFailure.status === 'rejected' && firstFailure.reason instanceof Error
        ? firstFailure.reason
        : new Error('MOPS 歷史重大訊息同步失敗')
    }

    const { recentEvents, historicalEvents } = splitRecentEvents(allEvents)
    const data: EventSet = {
      companyId,
      market,
      fetchedAt: new Date().toISOString(),
      source: '公開資訊觀測站－歷史重大訊息',
      allEvents,
      recentEvents,
      historicalEvents,
    }

    eventCache.set(cacheKey, { storedAt: Date.now(), data })
    return data
  })().finally(() => inflightRequests.delete(cacheKey))

  inflightRequests.set(cacheKey, request)
  return request
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError')
}

export async function fetchTwseHistoricalEvents(company: Company, signal: AbortSignal) {
  throwIfAborted(signal)
  const data = await loadEventSet(company.ticker, company.market)
  throwIfAborted(signal)

  return {
    companyId: data.companyId,
    market: data.market,
    fetchedAt: data.fetchedAt,
    source: data.source,
    events: data.historicalEvents,
  } satisfies TwseHistoricalEventsPayload
}

export async function fetchTwseRecentEventsFromHistory(ticker: string, market: string, signal?: AbortSignal) {
  throwIfAborted(signal)
  const data = await loadEventSet(ticker, market)
  throwIfAborted(signal)
  return {
    ticker,
    market,
    fetchedAt: data.fetchedAt,
    refreshIntervalHours: 4,
    lookbackDays: RECENT_EVENT_LOOKBACK_DAYS,
    maxEvents: RECENT_EVENT_LIMIT,
    source: data.source,
    events: data.recentEvents,
  }
}

export function mergeTwseHistoricalEvents(official: HistoricalEvent[], fallback: HistoricalEvent[]) {
  const merged = mergeHistoricalEventsRaw(official, fallback)
  return splitRecentEvents(merged).historicalEvents
}
