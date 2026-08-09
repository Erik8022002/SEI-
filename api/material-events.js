const MOPS_MATERIAL_EVENTS_URL = 'https://mops.twse.com.tw/mops/api/t05st01'
const LOOKBACK_DAYS = 14
const MAX_EVENTS = 20

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function formatRocDate(value) {
  const text = cleanText(value)
  const match = text.match(/^(\d{2,3})\/(\d{1,2})\/(\d{1,2})$/)
  if (!match) return text
  const year = Number(match[1]) + 1911
  return `${year}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
}

function classifyCategory(title) {
  if (/董事會|股東會|財務報告|股利|減資|增資|內控|改選|審計委員會|召開/.test(title)) return '公司治理'
  if (/合作|座談會|簽約|通路|市場|媒體|直播|供應|訂單/.test(title)) return '市場合作'
  if (/投資|募資|子公司|設廠|併購|取得|處分|開發|建置|債券|資本公積|資產/.test(title)) return '技術投資'
  return '營運發展'
}

function classifyImpact(title) {
  if (/損失|虧損|違約|訴訟|裁罰|停工|災害|資安|下修|終止|解任/.test(title)) return '留意'
  if (/營收.*成長|獲利|取得.*訂單|簽署.*合作|擴產|增產|創新高|上修/.test(title)) return '正向'
  return '中性'
}

function toMaterialEvent(row) {
  const cells = Array.isArray(row) ? row : []
  const date = formatRocDate(cells[2])
  const title = cleanText(cells[4])
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !title) return null

  return {
    date,
    category: classifyCategory(title),
    title,
    summary: title,
    impact: classifyImpact(title),
  }
}

function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getLookbackRange() {
  const end = new Date()
  end.setHours(23, 59, 59, 999)

  const start = new Date(end)
  start.setDate(start.getDate() - (LOOKBACK_DAYS - 1))
  start.setHours(0, 0, 0, 0)

  return {
    start,
    end,
    startKey: toDateKey(start),
    endKey: toDateKey(end),
  }
}

async function fetchYear(companyId, year) {
  const response = await fetch(MOPS_MATERIAL_EVENTS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'Compass-Financial-Intelligence/1.0',
    },
    body: JSON.stringify({
      companyId,
      year: String(year),
      month: 'all',
      firstDay: '',
      lastDay: '',
    }),
  })

  if (!response.ok) throw new Error(`MOPS 重大訊息回應 ${response.status}`)

  const payload = await response.json()
  const rows = payload?.result?.data
  if (!Array.isArray(rows)) return []

  return rows.map(toMaterialEvent).filter(Boolean)
}

function mergeAndLimitEvents(events, startKey, endKey) {
  const seen = new Set()

  return events
    .filter((event) => event.date >= startKey && event.date <= endKey)
    .filter((event) => {
      const key = `${event.date}-${event.title}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.title.localeCompare(a.title))
    .slice(0, MAX_EVENTS)
}

export async function getMaterialEvents({ ticker }) {
  const { start, end, startKey, endKey } = getLookbackRange()
  const rocYears = [...new Set([start.getFullYear() - 1911, end.getFullYear() - 1911])]
  const settled = await Promise.allSettled(rocYears.map((year) => fetchYear(ticker, year)))
  const fulfilled = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : [])

  if (fulfilled.length === 0 && settled.every((result) => result.status === 'rejected')) {
    const rejected = settled.find((result) => result.status === 'rejected')
    throw rejected?.reason instanceof Error ? rejected.reason : new Error('MOPS 重大訊息同步失敗')
  }

  return mergeAndLimitEvents(fulfilled, startKey, endKey)
}

export default async function handler(request, response) {
  if (request.method && request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const tickerValue = Array.isArray(request.query?.ticker) ? request.query.ticker[0] : request.query?.ticker
  const marketValue = Array.isArray(request.query?.market) ? request.query.market[0] : request.query?.market
  const ticker = cleanText(tickerValue)
  const market = cleanText(marketValue)

  if (!/^\d{4,6}$/.test(ticker) || !['上市', '上櫃'].includes(market)) {
    return response.status(400).json({ error: 'ticker 與 market 參數不正確' })
  }

  try {
    const events = await getMaterialEvents({ ticker, market })
    const { startKey, endKey } = getLookbackRange()

    response.setHeader('Cache-Control', 's-maxage=14400, stale-while-revalidate=600')
    return response.status(200).json({
      ticker,
      market,
      fetchedAt: new Date().toISOString(),
      refreshIntervalHours: 4,
      lookbackDays: LOOKBACK_DAYS,
      maxEvents: MAX_EVENTS,
      range: { start: startKey, end: endKey },
      source: '公開資訊觀測站－歷史重大訊息',
      events,
    })
  } catch (error) {
    return response.status(502).json({
      error: error instanceof Error ? error.message : '重大訊息同步失敗',
    })
  }
}
