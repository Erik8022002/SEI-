const TWSE_BASE_URL = 'https://openapi.twse.com.tw/v1'
const ENDPOINTS = {
  companies: `${TWSE_BASE_URL}/opendata/t187ap03_L`,
  revenue: `${TWSE_BASE_URL}/opendata/t187ap05_L`,
  trading: `${TWSE_BASE_URL}/exchangeReport/STOCK_DAY_ALL`,
  valuation: `${TWSE_BASE_URL}/exchangeReport/BWIBBU_ALL`,
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeName(value) {
  return cleanText(value)
    .replace(/臺/g, '台')
    .replace(/股份有限公司|有限公司|控股公司|控股/g, '')
    .replace(/[\s・·.()（）-]/g, '')
    .toLowerCase()
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
  return `${Number(digits.slice(0, 3)) + 1911}-${digits.slice(3, 5)}-${digits.slice(5, 7)}`
}

function formatFounded(value) {
  const digits = cleanText(value).replace(/\D/g, '')
  return digits.length >= 4 ? digits.slice(0, 4) : cleanText(value)
}

function formatCapital(value) {
  const capital = toNumber(value)
  if (capital === null) return ''
  return `${(capital / 100000000).toLocaleString('zh-TW', { maximumFractionDigits: 2 })} 億元`
}

function inBillionsFromThousands(value) {
  const number = toNumber(value)
  return number === null ? null : number / 100000
}

function findByName(rows, queryName, fullNameKey, shortNameKey, ticker) {
  const normalizedQuery = normalizeName(queryName)
  const exact = rows.find((row) => [row[fullNameKey], row[shortNameKey]].some((value) => normalizeName(value) === normalizedQuery))
  if (exact) return exact

  const partial = rows.find((row) => [row[fullNameKey], row[shortNameKey]].some((value) => {
    const candidate = normalizeName(value)
    return candidate && normalizedQuery && (candidate.includes(normalizedQuery) || normalizedQuery.includes(candidate))
  }))
  if (partial) return partial
  return ticker ? rows.find((row) => cleanText(row['公司代號'] ?? row.Code) === ticker) : undefined
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

function buildMetrics(revenueRow, valuationRow) {
  const metrics = []
  const monthlyRevenue = inBillionsFromThousands(revenueRow?.['營業收入-當月營收'])
  const cumulativeRevenue = inBillionsFromThousands(revenueRow?.['累計營業收入-當月累計營收'])
  const revenueYearMonth = cleanText(revenueRow?.['資料年月'])
  const peRatio = toNumber(valuationRow?.PEratio)
  const dividendYield = toNumber(valuationRow?.DividendYield)

  if (monthlyRevenue !== null) metrics.push({
    label: '最新月營收',
    value: monthlyRevenue,
    delta: toNumber(revenueRow?.['營業收入-去年同月增減(%)']) ?? 0,
    suffix: '億元',
    note: `${revenueYearMonth || '最新月份'} · 年增率`,
  })
  if (cumulativeRevenue !== null) metrics.push({
    label: '本年累計營收',
    value: cumulativeRevenue,
    delta: toNumber(revenueRow?.['累計營業收入-前期比較增減(%)']) ?? 0,
    suffix: '億元',
    note: `${revenueYearMonth || '最新月份'} · 累計年增率`,
  })
  if (peRatio !== null) metrics.push({ label: '本益比', value: peRatio, delta: 0, suffix: '倍', note: 'TWSE 每日估值' })
  if (dividendYield !== null) metrics.push({ label: '殖利率', value: dividendYield, delta: 0, suffix: '%', note: 'TWSE 每日估值' })
  return metrics
}

function buildStrategyMetrics(revenueRow, valuationRow) {
  const monthlyRevenue = inBillionsFromThousands(revenueRow?.['營業收入-當月營收'])
  const peRatio = toNumber(valuationRow?.PEratio)
  const dividendYield = toNumber(valuationRow?.DividendYield)
  const pbRatio = toNumber(valuationRow?.PBratio)
  return [
    monthlyRevenue === null ? null : { id: 'revenue', label: '最新月營收', value: `${monthlyRevenue.toLocaleString('zh-TW', { maximumFractionDigits: 1 })} 億元`, note: 'TWSE 月營收' },
    peRatio === null ? null : { id: 'peRatio', label: '本益比', value: `${peRatio} 倍`, note: 'TWSE 每日估值' },
    dividendYield === null ? null : { id: 'dividendYield', label: '殖利率', value: `${dividendYield}%`, note: 'TWSE 每日估值' },
    pbRatio === null ? null : { id: 'pbRatio', label: '股價淨值比', value: `${pbRatio} 倍`, note: 'TWSE 每日估值' },
  ].filter(Boolean)
}

export async function getTwseCompanyByName(name, ticker = '') {
  const [companyRows, revenueRows, tradingRows, valuationRows] = await Promise.all(Object.values(ENDPOINTS).map(fetchRows))
  const basicRow = findByName(companyRows, name, '公司名稱', '公司簡稱', ticker)
  if (!basicRow) return null

  const resolvedTicker = cleanText(basicRow['公司代號'])
  const revenueRow = revenueRows.find((row) => cleanText(row['公司代號']) === resolvedTicker)
  const tradingRow = tradingRows.find((row) => cleanText(row.Code) === resolvedTicker)
  const valuationRow = valuationRows.find((row) => cleanText(row.Code) === resolvedTicker)
  const industry = cleanText(revenueRow?.['產業別']) || cleanText(basicRow['產業別'])
  const shortName = cleanText(basicRow['公司簡稱'])
  const companyName = cleanText(basicRow['公司名稱']) || shortName
  const updatedDate = formatRocDate(revenueRow?.['出表日期'] || tradingRow?.Date || basicRow['出表日期'])

  return {
    queryName: name,
    resolvedName: companyName,
    ticker: resolvedTicker,
    company: {
      name: companyName,
      englishName: cleanText(basicRow['英文簡稱']),
      website: cleanText(basicRow['網址']),
      ticker: resolvedTicker,
      taxId: cleanText(basicRow['營利事業統一編號']),
      industry,
      market: '上市',
      location: cleanText(basicRow['住址']),
      founded: formatFounded(basicRow['成立日期']),
      capital: formatCapital(basicRow['實收資本額']),
      updatedAt: updatedDate || new Date().toISOString(),
      summary: `${shortName || companyName}為臺灣證券交易所上市公司，產業分類為${industry || '未分類'}；本頁基本資料與市場指標已由 TWSE OpenAPI 更新。`,
      metrics: buildMetrics(revenueRow, valuationRow),
      strategyMetrics: buildStrategyMetrics(revenueRow, valuationRow),
    },
    market: tradingRow ? {
      date: formatRocDate(tradingRow.Date),
      close: toNumber(tradingRow.ClosingPrice),
      change: toNumber(tradingRow.Change),
      tradeVolume: toNumber(tradingRow.TradeVolume),
    } : null,
  }
}

export default async function handler(request, response) {
  if (request.method && request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const nameValue = Array.isArray(request.query?.name) ? request.query.name[0] : request.query?.name
  const tickerValue = Array.isArray(request.query?.ticker) ? request.query.ticker[0] : request.query?.ticker
  const name = cleanText(nameValue)
  const ticker = cleanText(tickerValue)

  if (name.length < 2 || name.length > 80) {
    return response.status(400).json({ error: 'name 參數不正確' })
  }

  try {
    const result = await getTwseCompanyByName(name, ticker)
    if (!result) return response.status(404).json({ error: `TWSE 查無「${name}」的上市公司資料` })

    response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=21600')
    return response.status(200).json({
      ...result,
      fetchedAt: new Date().toISOString(),
      source: 'Taiwan Stock Exchange OpenAPI',
      sourceUrl: 'https://openapi.twse.com.tw/',
    })
  } catch (error) {
    return response.status(502).json({
      error: error instanceof Error ? error.message : 'TWSE 公司資料同步失敗',
    })
  }
}
