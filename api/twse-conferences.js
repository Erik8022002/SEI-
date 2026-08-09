import * as cheerio from 'cheerio'

const MOPS_CONFERENCE_URL = 'https://mopsov.twse.com.tw/mops/web/ajax_t100sb02_1'
const MOPS_PDF_ROOT = 'https://mopsov.twse.com.tw/nas/STR/'
const CONFERENCE_LOOKBACK_YEARS = 3

function cleanText(value) {
  return String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

function normalizeMarket(value) {
  const market = cleanText(value)
  if (market === '上櫃') return 'otc'
  if (market === '興櫃') return 'rotc'
  if (market === '公開發行') return 'pub'
  return 'sii'
}

function formatMarket(value) {
  if (value === 'otc') return '上櫃'
  if (value === 'rotc') return '興櫃'
  if (value === 'pub') return '公開發行'
  return '上市'
}

function toGregorian(rocDate) {
  const text = cleanText(rocDate)
  if (text.includes(' 至 ')) return text.split(' 至 ').map(toGregorian).join(' 至 ')
  const rocMatch = text.match(/^(\d{3})\/(\d{2})\/(\d{2})$/)
  if (rocMatch) return `${Number(rocMatch[1]) + 1911}-${rocMatch[2]}-${rocMatch[3]}`
  const gregorianMatch = text.match(/^(\d{4})\/(\d{2})\/(\d{2})$/)
  if (gregorianMatch) return `${gregorianMatch[1]}-${gregorianMatch[2]}-${gregorianMatch[3]}`
  return text
}

function parseRows(html, market, ticker) {
  const $ = cheerio.load(html)

  return $('#myTable tr[data-type="body"]').map((_, row) => {
    const cells = $(row).find('td')
    const companyCode = cleanText($(cells[0]).text())
    if (companyCode !== ticker) return null

    const presentationFile = (index) => $(cells[index]).find('a').attr('onclick')?.match(/fileName\.value=["']([^"']+)["']/)?.[1] ?? null
    const links = (index) => $(cells[index]).find('a[href]').map((__, anchor) => $(anchor).attr('href')).get().filter((href) => href && href !== '#')
    const website = links(8)[0] ?? ''
    const videos = links(9)
      .filter((href) => /^https?:/i.test(href))
      .map((href) => href.replace(/^http:/i, 'https:'))
    const chineseFile = presentationFile(6)
    const englishFile = presentationFile(7)

    return {
      companyCode,
      companyName: cleanText($(cells[1]).text()),
      market: formatMarket(market),
      date: toGregorian(cleanText($(cells[2]).text())),
      time: cleanText($(cells[3]).text()),
      location: cleanText($(cells[4]).text()),
      summary: cleanText($(cells[5]).text()),
      presentationZh: chineseFile ? MOPS_PDF_ROOT + chineseFile : '',
      presentationEn: englishFile ? MOPS_PDF_ROOT + englishFile : '',
      website,
      videos,
      notes: cleanText($(cells[10]).text()).replace(/^無$/, ''),
    }
  }).get().filter(Boolean)
}

async function fetchYear(market, year, ticker) {
  const body = new URLSearchParams({
    step: '1',
    firstin: '1',
    off: '1',
    TYPEK: market,
    year: String(year),
    month: '',
    co_id: '',
  })

  const response = await fetch(MOPS_CONFERENCE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      Referer: 'https://mopsov.twse.com.tw/mops/web/t100sb02_1',
      'User-Agent': 'CompassFinancialIntelligence/0.1 (public-data importer)',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
    body,
  })

  if (!response.ok) throw new Error(`MOPS ${market} ${year} failed: ${response.status}`)
  const html = await response.text()
  return parseRows(html, market, ticker)
}

function conferenceSortKey(item) {
  return `${cleanText(item.date).split(' 至 ')[0]} ${cleanText(item.time)}`
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
    .sort((a, b) => conferenceSortKey(b).localeCompare(conferenceSortKey(a)))
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
  const marketLabel = cleanText(marketValue)
  const currentRocYear = new Date().getFullYear() - 1911
  const requestedYear = Number(cleanText(yearValue))
  const endYear = Number.isInteger(requestedYear) && requestedYear >= 100 && requestedYear <= 999
    ? requestedYear
    : currentRocYear
  const years = Array.from({ length: CONFERENCE_LOOKBACK_YEARS }, (_, index) => endYear - index)

  if (!ticker || !/^[0-9]{4,6}$/.test(ticker)) {
    return response.status(400).json({ error: 'ticker 參數不正確' })
  }

  if (!['上市', '上櫃', '興櫃', '公開發行'].includes(marketLabel)) {
    return response.status(400).json({ error: 'market 參數不正確' })
  }

  try {
    const market = normalizeMarket(marketLabel)
    const settled = await Promise.allSettled(years.map((year) => fetchYear(market, year, ticker)))
    const successfulGroups = settled
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value)

    if (successfulGroups.length === 0) {
      const firstFailure = settled.find((result) => result.status === 'rejected')
      throw firstFailure?.reason instanceof Error ? firstFailure.reason : new Error('MOPS 法說會同步失敗')
    }

    const conferences = mergeConferenceRows(successfulGroups)
    const startYear = endYear - (CONFERENCE_LOOKBACK_YEARS - 1)

    response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300')
    return response.status(200).json({
      ticker,
      market: marketLabel,
      years: years.map(String),
      rangeLabel: `${startYear + 1911}–${endYear + 1911}`,
      fetchedAt: new Date().toISOString(),
      source: '公開資訊觀測站－法人說明會一覽表',
      successfulYears: settled.filter((result) => result.status === 'fulfilled').length,
      failedYears: settled.filter((result) => result.status === 'rejected').length,
      conferences,
    })
  } catch (error) {
    return response.status(502).json({
      error: error instanceof Error ? error.message : '法說會資料同步失敗',
    })
  }
}
