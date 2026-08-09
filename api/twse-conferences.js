import * as cheerio from 'cheerio'

const MOPS_CONFERENCE_URLS = [
  'https://mopsov.twse.com.tw/mops/web/ajax_t100sb02_1',
  'https://mops.twse.com.tw/mops/web/ajax_t100sb02_1',
]
const MOPS_CONFERENCE_REFERERS = [
  'https://mopsov.twse.com.tw/mops/web/t100sb02_1',
  'https://mops.twse.com.tw/mops/web/t100sb02_1',
]
const CONFERENCE_LOOKBACK_YEARS = 3
const MONTHS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'))
const QUERY_CONCURRENCY = 6

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function formatMarket(value) {
  if (value === '上櫃') return '上櫃'
  if (value === '興櫃') return '興櫃'
  if (value === '公開發行') return '公開發行'
  return '上市'
}

function normalizeHref(value) {
  const href = cleanText(value)
  if (!href || href === '#' || href.startsWith('javascript:')) return ''
  try {
    return new URL(href, 'https://mopsov.twse.com.tw').toString()
  } catch {
    return href
  }
}

function extractPdfUrl(cell) {
  const href = cell.find('a').attr('href')
  const normalizedHref = normalizeHref(href)
  if (normalizedHref) return normalizedHref

  const onclick = cell.find('a').attr('onclick') || cell.attr('onclick') || ''
  const match = onclick.match(/fileName\.value\s*=\s*["']([^"']+)["']/)
  if (!match) return ''
  return `https://mopsov.twse.com.tw/home/t05st02/${match[1]}`
}

function extractFirstHref(cell) {
  return normalizeHref(cell.find('a').attr('href'))
}

function normalizeConferenceDate(value) {
  return cleanText(value).replace(/\b(\d{2,3})[\/-](\d{1,2})[\/-](\d{1,2})\b/g, (_, rocYear, month, day) => {
    const year = Number(rocYear) + 1911
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }).replace(/\b(\d{4})\/(\d{1,2})\/(\d{1,2})\b/g, (_, year, month, day) => (
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  ))
}

function parseConferenceRows(html, market, ticker) {
  const $ = cheerio.load(html)
  const conferences = []

  $('table tr').each((_, row) => {
    const cells = $(row).find('td')
    if (cells.length < 6) return

    const texts = cells.map((__, cell) => cleanText($(cell).text())).get()
    const codeIndex = texts.findIndex((text) => text === ticker)
    if (codeIndex < 0) return

    const code = texts[codeIndex]
    const name = texts[codeIndex + 1] ?? ''
    const date = normalizeConferenceDate(texts[codeIndex + 2] ?? '')
    const time = texts[codeIndex + 3] ?? ''
    const location = texts[codeIndex + 4] ?? ''
    const summary = texts[codeIndex + 5] ?? ''

    if (!code || !date || !summary) return

    const presentationZh = cells.length > codeIndex + 6 ? extractPdfUrl(cells.eq(codeIndex + 6)) : ''
    const presentationEn = cells.length > codeIndex + 7 ? extractPdfUrl(cells.eq(codeIndex + 7)) : ''
    const website = cells.length > codeIndex + 8 ? extractFirstHref(cells.eq(codeIndex + 8)) : ''
    const video = cells.length > codeIndex + 9 ? extractFirstHref(cells.eq(codeIndex + 9)) : ''
    const notes = cells.length > codeIndex + 10 ? cleanText(cells.eq(codeIndex + 10).text()) : ''

    conferences.push({
      date,
      time,
      companyCode: code,
      companyName: name,
      market: formatMarket(market),
      summary,
      location,
      presentationZh,
      videos: video ? [video] : [],
      website,
      presentationEn,
      notes,
    })
  })

  return conferences
}

async function queryConferenceHtml({ ticker, year, month }) {
  const body = new URLSearchParams({
    encodeURIComponent: '1',
    step: '1',
    firstin: '1',
    off: '1',
    queryName: 'co_id',
    inpuType: 'co_id',
    TYPEK: 'all',
    isnew: 'false',
    year,
    month,
    co_id: ticker,
  })

  let lastError = null

  for (let index = 0; index < MOPS_CONFERENCE_URLS.length; index += 1) {
    try {
      const response = await fetch(MOPS_CONFERENCE_URLS[index], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          Referer: MOPS_CONFERENCE_REFERERS[index],
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
        body,
      })

      if (!response.ok) throw new Error(`MOPS 法說會查詢回應 ${response.status}`)
      const html = await response.text()
      if (!html) throw new Error('MOPS 法說會查詢回傳空內容')
      return html
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('MOPS 法說會查詢失敗')
}

function conferenceSortKey(item) {
  const text = cleanText(item?.date)
  const match = text.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/)
  if (!match) return text
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
}

function mergeConferenceRows(groups) {
  const seen = new Set()
  return groups
    .flat()
    .filter((item) => {
      const key = [item.companyCode, item.date, item.time, item.summary, item.location].join('|')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => conferenceSortKey(b).localeCompare(conferenceSortKey(a)) || cleanText(b.time).localeCompare(cleanText(a.time)))
}

async function queryPeriods(periods, worker) {
  const fulfilled = []
  const rejected = []

  for (let index = 0; index < periods.length; index += QUERY_CONCURRENCY) {
    const batch = periods.slice(index, index + QUERY_CONCURRENCY)
    const settled = await Promise.allSettled(batch.map(worker))

    settled.forEach((result, batchIndex) => {
      const period = batch[batchIndex]
      if (result.status === 'fulfilled') {
        fulfilled.push({ period, value: result.value })
      } else {
        rejected.push({ period, reason: result.reason })
      }
    })
  }

  return { fulfilled, rejected }
}

export default async function handler(request, response) {
  if (request.method && request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const tickerValue = Array.isArray(request.query?.ticker) ? request.query.ticker[0] : request.query?.ticker
  const marketValue = Array.isArray(request.query?.market) ? request.query.market[0] : request.query?.market
  const yearValue = Array.isArray(request.query?.year) ? request.query.year[0] : request.query?.year

  const ticker = cleanText(tickerValue)
  const market = cleanText(marketValue)
  const currentRocYear = new Date().getFullYear() - 1911
  const requestedYear = Number(cleanText(yearValue))
  const endYear = Number.isInteger(requestedYear) && requestedYear >= 100 && requestedYear <= 999
    ? requestedYear
    : currentRocYear
  const years = Array.from({ length: CONFERENCE_LOOKBACK_YEARS }, (_, index) => String(endYear - index))
  const periods = years.flatMap((year) => MONTHS.map((month) => ({ year, month })))

  if (!ticker || !/^[0-9]{4,6}$/.test(ticker)) {
    return response.status(400).json({ error: 'ticker 參數不正確' })
  }

  if (!['上市', '上櫃', '興櫃', '公開發行'].includes(market)) {
    return response.status(400).json({ error: 'market 參數不正確' })
  }

  try {
    const { fulfilled, rejected } = await queryPeriods(periods, async ({ year, month }) => {
      const html = await queryConferenceHtml({ ticker, year, month })
      if (/查無資料/.test(html)) return []
      return parseConferenceRows(html, market, ticker)
    })

    if (fulfilled.length === 0) {
      const firstFailure = rejected[0]?.reason
      throw firstFailure instanceof Error ? firstFailure : new Error('MOPS 法說會同步失敗')
    }

    const conferences = mergeConferenceRows(fulfilled.map((result) => result.value))
    const startYear = endYear - (CONFERENCE_LOOKBACK_YEARS - 1)

    response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300')
    return response.status(200).json({
      ticker,
      market,
      years,
      months: MONTHS,
      rangeLabel: `${startYear + 1911}–${endYear + 1911}`,
      fetchedAt: new Date().toISOString(),
      source: '公開資訊觀測站－法人說明會一覽表',
      queryCount: periods.length,
      successfulQueries: fulfilled.length,
      failedQueries: rejected.length,
      conferences,
    })
  } catch (error) {
    return response.status(502).json({
      error: error instanceof Error ? error.message : '法說會資料同步失敗',
    })
  }
}
