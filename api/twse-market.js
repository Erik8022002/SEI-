const TWSE_BASE_URL = 'https://openapi.twse.com.tw/v1'
const TRADE_URL = `${TWSE_BASE_URL}/exchangeReport/STOCK_DAY_ALL`
const VALUATION_URL = `${TWSE_BASE_URL}/exchangeReport/BWIBBU_ALL`

function cleanText(value) {
  return String(value ?? '').trim()
}

function toNumber(value) {
  const normalized = cleanText(value).replace(/,/g, '')
  if (!normalized || normalized === '--' || normalized === 'N/A') return null
  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

function formatRocDate(value) {
  const digits = cleanText(value).replace(/\D/g, '')
  if (digits.length !== 7) return cleanText(value)
  const year = Number(digits.slice(0, 3)) + 1911
  return `${year}-${digits.slice(3, 5)}-${digits.slice(5, 7)}`
}

function buildSnapshot(ticker, tradeRow, valuationRow) {
  if (!tradeRow && !valuationRow) {
    return {
      ticker,
      available: false,
      reason: 'TWSE 查無此上市股票的每日市場資料',
    }
  }

  const close = toNumber(tradeRow?.ClosingPrice)
  const change = toNumber(tradeRow?.Change)
  const previousClose = close !== null && change !== null ? close - change : null
  const changePercent = previousClose ? (change / previousClose) * 100 : null

  return {
    ticker,
    available: true,
    name: cleanText(tradeRow?.Name || valuationRow?.Name),
    date: formatRocDate(tradeRow?.Date || valuationRow?.Date),
    market: {
      open: toNumber(tradeRow?.OpeningPrice),
      high: toNumber(tradeRow?.HighestPrice),
      low: toNumber(tradeRow?.LowestPrice),
      close,
      change,
      changePercent,
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

async function fetchRows(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Compass-Financial-Intelligence/1.0',
    },
  })

  if (!response.ok) throw new Error(`TWSE OpenAPI 回應 ${response.status}`)
  const rows = await response.json()
  if (!Array.isArray(rows)) throw new Error('TWSE OpenAPI 資料格式錯誤')
  return rows
}

export async function getTwseMarketSnapshot(ticker) {
  const [tradeRows, valuationRows] = await Promise.all([
    fetchRows(TRADE_URL),
    fetchRows(VALUATION_URL),
  ])
  const tradeRow = tradeRows.find((row) => cleanText(row.Code) === ticker)
  const valuationRow = valuationRows.find((row) => cleanText(row.Code) === ticker)
  return buildSnapshot(ticker, tradeRow, valuationRow)
}

export default async function handler(request, response) {
  if (request.method && request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const tickerValue = Array.isArray(request.query?.ticker) ? request.query.ticker[0] : request.query?.ticker
  const marketValue = Array.isArray(request.query?.market) ? request.query.market[0] : request.query?.market
  const ticker = cleanText(tickerValue).toUpperCase()
  const market = cleanText(marketValue)

  if (!/^\d{4,6}[A-Z]?$/.test(ticker)) {
    return response.status(400).json({ error: 'ticker 參數不正確' })
  }

  if (market && market !== '上市') {
    response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=3600')
    return response.status(200).json({
      ticker,
      available: false,
      reason: 'TWSE OpenAPI 僅提供上市市場資料',
      fetchedAt: new Date().toISOString(),
      source: 'Taiwan Stock Exchange OpenAPI',
    })
  }

  try {
    const snapshot = await getTwseMarketSnapshot(ticker)
    response.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600')
    return response.status(200).json({
      ...snapshot,
      fetchedAt: new Date().toISOString(),
      source: 'Taiwan Stock Exchange OpenAPI',
      sourceUrl: 'https://openapi.twse.com.tw/',
    })
  } catch (error) {
    return response.status(502).json({
      error: error instanceof Error ? error.message : 'TWSE 市場資料同步失敗',
    })
  }
}
