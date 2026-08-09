const MOPS_HISTORICAL_NEWS_URL = 'https://mops.twse.com.tw/mops/api/t05st01'

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function mapMarketKind(value) {
  const market = cleanText(value)
  if (market === '上櫃') return 'otc'
  if (market === '興櫃') return 'rotc'
  if (market === '公開發行') return 'pub'
  return 'sii'
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

function cleanRow(row) {
  return Array.isArray(row) ? row : []
}

function toHistoricalEvent(row) {
  const cells = cleanRow(row)
  const date = formatRocDate(cells[2])
  const title = cleanText(cells[4])
  if (!date || !title) return null

  return {
    date,
    category: classifyCategory(title),
    title,
    summary: title,
  }
}

async function fetchYear(companyId, marketKind, year) {
  const body = {
    companyId,
    year: String(year),
    month: 'all',
    firstDay: '',
    lastDay: '',
  }

  const response = await fetch(MOPS_HISTORICAL_NEWS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'Compass-Financial-Intelligence/1.0',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) throw new Error(`MOPS 歷史重大訊息回應 ${response.status}`)

  const payload = await response.json()
  const rows = payload?.result?.data
  if (!Array.isArray(rows)) return []

  return rows
    .map(toHistoricalEvent)
    .filter(Boolean)
}

function mergeEvents(official, fallback) {
  const seen = new Set()
  return [...official, ...fallback]
    .filter((event) => {
      const key = `${event.date}-${event.title}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.title.localeCompare(a.title))
}

export default async function handler(request, response) {
  if (request.method && request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const companyIdValue = Array.isArray(request.query?.ticker) ? request.query.ticker[0] : request.query?.ticker
  const marketValue = Array.isArray(request.query?.market) ? request.query.market[0] : request.query?.market
  const yearsValue = Array.isArray(request.query?.years) ? request.query.years[0] : request.query?.years

  const companyId = cleanText(companyIdValue)
  const market = cleanText(marketValue)
  const years = Number.parseInt(cleanText(yearsValue), 10)
  const yearCount = Number.isFinite(years) && years > 0 ? Math.min(years, 20) : 20

  if (!/^[0-9]{4,6}$/.test(companyId)) {
    return response.status(400).json({ error: 'ticker 參數不正確' })
  }

  if (!market) {
    return response.status(400).json({ error: 'market 參數不正確' })
  }

  try {
    const currentYear = new Date().getFullYear() - 1911
    const marketKind = mapMarketKind(market)
    const targets = Array.from({ length: yearCount }, (_, index) => currentYear - index)
    const settled = await Promise.allSettled(targets.map((year) => fetchYear(companyId, marketKind, year)))
    const events = mergeEvents(
      settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []),
      [],
    )

    response.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600')
    return response.status(200).json({
      companyId,
      market,
      fetchedAt: new Date().toISOString(),
      source: '公開資訊觀測站－歷史重大訊息',
      years: yearCount,
      events,
    })
  } catch (error) {
    return response.status(502).json({
      error: error instanceof Error ? error.message : '歷史重大訊息同步失敗',
    })
  }
}
