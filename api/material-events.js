import * as cheerio from 'cheerio'

const MOPS_MATERIAL_EVENTS_URL = 'https://mopsov.twse.com.tw/mops/web/ajax_t05st01'
const TWSE_MATERIAL_EVENTS_URL = 'https://openapi.twse.com.tw/v1/opendata/t187ap04_L'
const TPEX_MATERIAL_EVENTS_URL = 'https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap04_O'
const LOOKBACK_DAYS = 14
const MAX_EVENTS = 20

function cleanText(value) {
  return String(value ?? '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
}

function formatRocDate(value) {
  const text = cleanText(value)

  const slashMatch = text.match(/(\d{2,3})\/(\d{1,2})\/(\d{1,2})/)
  if (slashMatch) {
    const year = Number(slashMatch[1]) + 1911
    return `${year}-${slashMatch[2].padStart(2, '0')}-${slashMatch[3].padStart(2, '0')}`
  }

  const digits = text.replace(/\D/g, '')
  if (digits.length === 7) {
    const year = Number(digits.slice(0, 3)) + 1911
    return `${year}-${digits.slice(3, 5)}-${digits.slice(5, 7)}`
  }
  if (digits.length >= 8 && /^20\d{6}/.test(digits)) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
  }

  return ''
}

function classifyCategory(title) {
  if (/董事會|股東會|財務報告|股利|減資|增資|內控|改選|審計委員會|召開/.test(title)) return '公司治理'
  if (/合作|座談會|簽約|通路|市場|媒體|直播|供應|訂單/.test(title)) return '市場合作'
  if (/投資|募資|子公司|設廠|併購|取得|處分|開發|建置|債券|資本公積|資產/.test(title)) return '技術投資'
  return '營運發展'
}

function classifyImpact(title, description = '') {
  const text = `${title} ${description}`
  if (/損失|虧損|違約|訴訟|裁罰|停工|災害|資安|下修|終止|解任/.test(text)) return '留意'
  if (/營收.*成長|獲利|取得.*訂單|簽署.*合作|擴產|增產|創新高|上修/.test(text)) return '正向'
  return '中性'
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
  return { start, end, startKey: toDateKey(start), endKey: toDateKey(end) }
}

function normalizeMarket(value) {
  if (value === '上櫃') return 'otc'
  if (value === '興櫃') return 'rotc'
  if (value === '公開發行') return 'pub'
  return 'sii'
}

function looksLikeDate(value) {
  return /\d{2,3}\/\d{1,2}\/\d{1,2}/.test(value) || /^\d{7,8}$/.test(value.replace(/\D/g, ''))
}

function parseMopsRows(html, ticker) {
  if (/查詢過於頻繁|FOR SECURITY REASONS|無法呈現/.test(html)) {
    throw new Error('MOPS 暫時限制查詢')
  }
  if (/查無資料/.test(html)) return []

  const $ = cheerio.load(html)
  const events = []

  $('table').each((_, table) => {
    const $table = $(table)
    const headerCells = $table.find('tr').first().find('th,td').map((__, cell) => cleanText($(cell).text())).get()
    const dateHeaderIndex = headerCells.findIndex((header) => /發言日期|發布時間|日期/.test(header))
    const titleHeaderIndex = headerCells.findIndex((header) => /主旨/.test(header))

    $table.find('tr').each((__, row) => {
      const cells = $(row).find('td').map((___, cell) => cleanText($(cell).text())).get()
      if (cells.length < 4) return

      const codeIndex = cells.findIndex((cell) => cell === ticker)
      if (codeIndex < 0 && cells.some((cell) => /^\d{4,6}$/.test(cell))) return

      let rawDate = dateHeaderIndex >= 0 ? cells[dateHeaderIndex] : ''
      if (!looksLikeDate(rawDate)) rawDate = cells.find(looksLikeDate) || ''
      const date = formatRocDate(rawDate)
      if (!date) return

      let title = titleHeaderIndex >= 0 ? cleanText(cells[titleHeaderIndex]) : ''
      if (!title || title === '詳細資料') {
        const candidates = cells.filter((cell) =>
          cell &&
          cell !== ticker &&
          !looksLikeDate(cell) &&
          !/^\d{1,2}:\d{2}(:\d{2})?$/.test(cell) &&
          !/^(詳細資料|查詢)$/.test(cell) &&
          !/^\d+$/.test(cell)
        )
        title = candidates.sort((a, b) => b.length - a.length)[0] || ''
      }
      if (!title) return

      events.push({
        date,
        category: classifyCategory(title),
        title,
        summary: title,
        impact: classifyImpact(title),
      })
    })
  })

  return events
}

async function fetchMopsYear({ ticker, market, year }) {
  const body = new URLSearchParams({
    encodeURIComponent: '1',
    step: '1',
    firstin: '1',
    off: '1',
    keyword4: '',
    code1: '',
    TYPEK2: '',
    checkbtn: '',
    queryName: 'co_id',
    inpuType: 'co_id',
    TYPEK: normalizeMarket(market),
    co_id: ticker,
    year: String(year),
    month: '',
    b_date: '',
    e_date: '',
  })

  const response = await fetch(MOPS_MATERIAL_EVENTS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      'If-Modified-Since': 'Sat, 1 Jan 2000 00:00:00 GMT',
      'User-Agent': 'Mozilla/5.0 (compatible; Compass-Financial-Intelligence/1.0)',
      Referer: 'https://mops.twse.com.tw/mops/web/t05st01',
    },
    body,
  })

  if (!response.ok) throw new Error(`MOPS 重大訊息回應 ${response.status}`)
  return parseMopsRows(await response.text(), ticker)
}

function transformDailyEvent(row, market) {
  const title = cleanText(row['主旨'] ?? row['主旨 '])
  const description = cleanText(row['說明'])
  const date = formatRocDate(row['發言日期'] ?? row['事實發生日'])
  if (!date || !title) return null

  return {
    date,
    category: classifyCategory(title),
    title,
    summary: description || title,
    impact: classifyImpact(title, description),
    market,
  }
}

async function fetchDailyFallback({ ticker, market }) {
  const isOtc = market === '上櫃'
  const endpoint = isOtc ? TPEX_MATERIAL_EVENTS_URL : TWSE_MATERIAL_EVENTS_URL
  const codeKey = isOtc ? 'SecuritiesCompanyCode' : '公司代號'
  const response = await fetch(endpoint, {
    headers: { Accept: 'application/json', 'User-Agent': 'Compass-Financial-Intelligence/1.0' },
  })
  if (!response.ok) return []
  const rows = await response.json()
  if (!Array.isArray(rows)) return []

  return rows
    .filter((row) => String(row[codeKey] ?? '').trim() === ticker)
    .map((row) => transformDailyEvent(row, market))
    .filter(Boolean)
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

export async function getMaterialEvents({ ticker, market }) {
  const { start, end, startKey, endKey } = getLookbackRange()
  const rocYears = [...new Set([start.getFullYear() - 1911, end.getFullYear() - 1911])]

  try {
    const settled = await Promise.allSettled(rocYears.map((year) => fetchMopsYear({ ticker, market, year })))
    const events = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
    const recent = mergeAndLimitEvents(events, startKey, endKey)
    if (recent.length > 0) return { events: recent, source: '公開資訊觀測站－近兩週重大訊息' }

    if (settled.every((result) => result.status === 'rejected')) {
      throw new Error('MOPS 近兩週重大訊息查詢失敗')
    }

    return { events: [], source: '公開資訊觀測站－近兩週重大訊息' }
  } catch {
    const fallback = await fetchDailyFallback({ ticker, market })
    return {
      events: mergeAndLimitEvents(fallback, startKey, endKey),
      source: market === '上櫃' ? 'Taipei Exchange OpenAPI（當日備援）' : 'Taiwan Stock Exchange OpenAPI（當日備援）',
    }
  }
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
    const result = await getMaterialEvents({ ticker, market })
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
      source: result.source,
      events: result.events,
    })
  } catch (error) {
    return response.status(502).json({
      error: error instanceof Error ? error.message : '重大訊息同步失敗',
    })
  }
}
