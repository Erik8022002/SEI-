const TWSE_MATERIAL_EVENTS_URL = 'https://openapi.twse.com.tw/v1/opendata/t187ap04_L'
const TPEX_MATERIAL_EVENTS_URL = 'https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap04_O'

function cleanText(value) {
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatRocDate(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.length < 7) return cleanText(value)
  const year = Number(digits.slice(0, digits.length - 4)) + 1911
  const month = digits.slice(-4, -2)
  const day = digits.slice(-2)
  return `${year}.${month}.${day}`
}

function classifyCategory(title, description) {
  const text = `${title} ${description}`
  if (/財務|盈餘|股利|增資|減資|現金|債券|融資|會計|營收|損益|財報/.test(text)) return '財務'
  if (/董事|股東會|治理|經理人|發言人|內部人|審計|章程|更名/.test(text)) return '治理'
  if (/客戶|訂單|合作|市場|銷售|通路|投資人|法人說明會/.test(text)) return '市場'
  return '營運'
}

function classifyImpact(title, description) {
  const text = `${title} ${description}`
  if (/損失|虧損|違約|訴訟|裁罰|停工|災害|資安|下修|終止|解任/.test(text)) return '留意'
  if (/營收.*成長|獲利|取得.*訂單|簽署.*合作|擴產|增產|創新高|上修/.test(text)) return '正向'
  return '中性'
}

function transformEvent(row, market) {
  const title = cleanText(row['主旨'] ?? row['主旨 '])
  const description = cleanText(row['說明'])
  const summary = description.length > 220 ? `${description.slice(0, 220)}…` : description
  return {
    date: formatRocDate(row['發言日期'] ?? row['事實發生日']),
    category: classifyCategory(title, description),
    title,
    summary,
    impact: classifyImpact(title, description),
    market,
  }
}

export async function getMaterialEvents({ ticker, market }) {
  const isOtc = market === '上櫃'
  const endpoint = isOtc ? TPEX_MATERIAL_EVENTS_URL : TWSE_MATERIAL_EVENTS_URL
  const codeKey = isOtc ? 'SecuritiesCompanyCode' : '公司代號'
  const response = await fetch(endpoint, {
    headers: { Accept: 'application/json', 'User-Agent': 'Compass-Financial-Intelligence/1.0' },
  })

  if (!response.ok) throw new Error(`官方重大訊息服務回應 ${response.status}`)
  const rows = await response.json()
  if (!Array.isArray(rows)) throw new Error('官方重大訊息資料格式錯誤')

  return rows
    .filter((row) => String(row[codeKey] ?? '').trim() === ticker)
    .map((row) => transformEvent(row, market))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30)
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
    response.setHeader('Cache-Control', 's-maxage=14400, stale-while-revalidate=600')
    return response.status(200).json({
      ticker,
      market,
      fetchedAt: new Date().toISOString(),
      refreshIntervalHours: 4,
      source: market === '上櫃' ? 'Taipei Exchange OpenAPI' : 'Taiwan Stock Exchange OpenAPI',
      events,
    })
  } catch (error) {
    return response.status(502).json({
      error: error instanceof Error ? error.message : '重大訊息同步失敗',
    })
  }
}
