import * as cheerio from 'cheerio'

const MOPS_CONFERENCE_URL = 'https://mopsov.twse.com.tw/mops/web/ajax_t100sb02_1'

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function formatMarket(value) {
  if (value === '上櫃') return '上櫃'
  if (value === '興櫃') return '興櫃'
  if (value === '公開發行') return '公開發行'
  return '上市'
}

function extractPdfUrl(cell) {
  const href = cell.find('a').attr('href')
  if (href && href !== '#') return href

  const onclick = cell.find('a').attr('onclick') || cell.attr('onclick') || ''
  const match = onclick.match(/fileName\.value\s*=\s*"([^"]+)"/)
  if (!match) return ''
  return `https://mopsov.twse.com.tw/home/t05st02/${match[1]}`
}

function extractFirstHref(cell) {
  const href = cell.find('a').attr('href')
  if (!href || href === '#') return ''
  if (href.startsWith('javascript:')) return ''
  return href
}

function parseConferenceRows(html, market) {
  const $ = cheerio.load(html)
  const rows = $('tr[data-type="body"]')
  return rows.map((_, row) => {
    const cells = $(row).find('td')
    const code = cleanText(cells.eq(0).text())
    const name = cleanText(cells.eq(1).text())
    const date = cleanText(cells.eq(2).text())
    const time = cleanText(cells.eq(3).text())
    const location = cleanText(cells.eq(4).text())
    const summary = cleanText(cells.eq(5).text())
    const presentationZh = extractPdfUrl(cells.eq(6))
    const presentationEn = extractPdfUrl(cells.eq(7))
    const website = extractFirstHref(cells.eq(8))
    const video = extractFirstHref(cells.eq(9))
    const notes = cleanText(cells.eq(10).text())

    return {
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
    }
  }).get()
}

async function queryConferenceHtml({ ticker, market, year }) {
  const body = new URLSearchParams({
    subMenuID: '2',
    step: '1',
    firstin: '1',
    off: '1',
    TYPEK: market,
    year,
    month: 'all',
    co_id: ticker,
  })

  const response = await fetch(MOPS_CONFERENCE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Compass-Financial-Intelligence/1.0',
    },
    body,
  })

  if (!response.ok) throw new Error(`MOPS 法說會查詢回應 ${response.status}`)
  return response.text()
}

function normalizeMarket(value) {
  const market = cleanText(value)
  if (market === '上櫃') return 'otc'
  if (market === '興櫃') return 'rotc'
  if (market === '公開發行') return 'pub'
  return 'sii'
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
  const currentRocYear = String(new Date().getFullYear() - 1911)
  const requestedYear = cleanText(yearValue)
  const year = /^\d{3}$/.test(requestedYear) ? requestedYear : currentRocYear
  const month = 'all'

  if (!ticker || !/^[0-9]{4,6}$/.test(ticker)) {
    return response.status(400).json({ error: 'ticker 參數不正確' })
  }

  if (!['上市', '上櫃', '興櫃', '公開發行'].includes(market)) {
    return response.status(400).json({ error: 'market 參數不正確' })
  }

  try {
    const html = await queryConferenceHtml({ ticker, market: normalizeMarket(market), year })
    const conferences = /查無資料/.test(html)
      ? []
      : parseConferenceRows(html, market)

    return response.status(200).json({
      ticker,
      market,
      year,
      month,
      rangeLabel: `${Number(year) + 1911} 全年度`,
      fetchedAt: new Date().toISOString(),
      source: '公開資訊觀測站－法人說明會一覽表',
      conferences,
    })
  } catch (error) {
    return response.status(502).json({
      error: error instanceof Error ? error.message : '法說會資料同步失敗',
    })
  }
}
