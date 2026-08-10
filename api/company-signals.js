const FINMIND_DATA_URL = 'https://api.finmindtrade.com/api/v4/data'

const DATASETS = {
  revenue: 'TaiwanStockMonthRevenue',
  balanceSheet: 'TaiwanStockBalanceSheet',
  cashFlow: 'TaiwanStockCashFlowsStatement',
  institutional: 'TaiwanStockInstitutionalInvestorsBuySellWide',
}
const SIGNAL_CACHE_MS = 4 * 60 * 60 * 1000
const signalCache = new Map()
const inflightSignals = new Map()

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function dateKey(date) {
  return date.toISOString().slice(0, 10)
}

function yearsAgoStart(years) {
  const date = new Date()
  date.setUTCFullYear(date.getUTCFullYear() - years, 0, 1)
  return dateKey(date)
}

function daysAgo(days) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return dateKey(date)
}

async function fetchFinMindDataset(dataset, ticker, startDate, endDate) {
  const query = new URLSearchParams({
    dataset,
    data_id: ticker,
    start_date: startDate,
    end_date: endDate,
  })
  const token = cleanText(process.env.FINMIND_TOKEN)
  const response = await fetch(`${FINMIND_DATA_URL}?${query}`, {
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!response.ok) throw new Error(`${dataset} 回應 ${response.status}`)
  const payload = await response.json()
  if (payload?.status !== 200 || !Array.isArray(payload?.data)) {
    throw new Error(cleanText(payload?.msg) || `${dataset} 資料格式錯誤`)
  }
  return payload.data
}

function buildRevenueTrend(rows) {
  const totals = new Map()

  rows.forEach((row) => {
    const year = Number(row.revenue_year)
    const month = Number(row.revenue_month)
    const revenue = toNumber(row.revenue)
    if (!Number.isInteger(year) || !Number.isInteger(month) || revenue === null) return

    const current = totals.get(year) ?? { year, revenue: 0, months: new Set() }
    current.revenue += revenue
    current.months.add(month)
    totals.set(year, current)
  })

  const years = [...totals.values()]
    .filter((item) => item.months.size === 12)
    .sort((a, b) => b.year - a.year)
    .slice(0, 3)
    .sort((a, b) => a.year - b.year)
    .map((item, index, all) => ({
      year: item.year,
      revenue: item.revenue,
      yoy: index === 0 || all[index - 1].revenue === 0
        ? null
        : ((item.revenue - all[index - 1].revenue) / all[index - 1].revenue) * 100,
    }))

  if (years.length === 0) return null
  return {
    years,
    consecutiveGrowth: years.length === 3
      ? years.slice(1).every((item, index) => item.revenue > years[index].revenue)
      : null,
  }
}

function latestReportDate(rows, requiredTypes) {
  const dates = [...new Set(rows.map((row) => cleanText(row.date)).filter(Boolean))].sort().reverse()
  return dates.find((date) => requiredTypes.every((type) => rows.some((row) => row.date === date && row.type === type))) ?? ''
}

function metricValue(rows, date, types, originPattern) {
  const match = rows.find((row) => row.date === date && types.includes(cleanText(row.type)))
    ?? rows.find((row) => row.date === date && originPattern.test(cleanText(row.origin_name)) && !cleanText(row.type).endsWith('_per'))
  return toNumber(match?.value)
}

function buildLiquidity(balanceRows, cashFlowRows) {
  const reportDate = latestReportDate(balanceRows, ['CurrentAssets', 'CurrentLiabilities'])
  if (!reportDate) return null

  const currentAssets = metricValue(balanceRows, reportDate, ['CurrentAssets'], /^流動資產合計$/)
  const currentLiabilities = metricValue(balanceRows, reportDate, ['CurrentLiabilities'], /^流動負債合計$/)
  if (currentAssets === null || currentLiabilities === null) return null

  const debtTypes = new Set()
  const shortTermDebt = balanceRows
    .filter((row) => row.date === reportDate && !cleanText(row.type).endsWith('_per'))
    .filter((row) => /短期借款|應付短期票券|一年內到期/.test(cleanText(row.origin_name)))
    .reduce((total, row) => {
      const type = cleanText(row.type)
      const value = toNumber(row.value)
      if (!type || debtTypes.has(type) || value === null) return total
      debtTypes.add(type)
      return total + value
    }, 0)

  const availableCashFlowDates = [...new Set(cashFlowRows.map((row) => cleanText(row.date)).filter((date) => date && date <= reportDate))].sort().reverse()
  const cashFlowDate = availableCashFlowDates[0] ?? ''
  const operatingCashFlow = cashFlowDate
    ? metricValue(cashFlowRows, cashFlowDate, ['CashFlowsFromOperatingActivities'], /^營業活動之淨現金流入（流出）$/)
    : null

  return {
    reportDate,
    cashFlowDate: cashFlowDate || null,
    currentAssets,
    currentLiabilities,
    workingCapital: currentAssets - currentLiabilities,
    currentRatio: currentLiabilities === 0 ? null : (currentAssets / currentLiabilities) * 100,
    shortTermDebt: debtTypes.size > 0 ? shortTermDebt : null,
    shortTermFinancingRatio: currentLiabilities === 0 || debtTypes.size === 0 ? null : (shortTermDebt / currentLiabilities) * 100,
    operatingCashFlow,
    cashFlowRatio: currentLiabilities === 0 || operatingCashFlow === null ? null : (operatingCashFlow / currentLiabilities) * 100,
  }
}

function rowNet(row) {
  const net = (buyKey, sellKey) => (toNumber(row[buyKey]) ?? 0) - (toNumber(row[sellKey]) ?? 0)
  const foreign = net('Foreign_Investor_buy', 'Foreign_Investor_sell')
  const investmentTrust = net('Investment_Trust_buy', 'Investment_Trust_sell')
  const dealer = net('Dealer_buy', 'Dealer_sell')
    + net('Dealer_self_buy', 'Dealer_self_sell')
    + net('Dealer_Hedging_buy', 'Dealer_Hedging_sell')
  return { foreign, investmentTrust, dealer, total: foreign + investmentTrust + dealer }
}

function aggregateInstitutional(rows, requestedDays) {
  const selected = rows.slice(-requestedDays)
  if (selected.length === 0) return null

  const totals = selected.reduce((sum, row) => {
    const values = rowNet(row)
    return {
      foreign: sum.foreign + values.foreign,
      investmentTrust: sum.investmentTrust + values.investmentTrust,
      dealer: sum.dealer + values.dealer,
      total: sum.total + values.total,
    }
  }, { foreign: 0, investmentTrust: 0, dealer: 0, total: 0 })

  return {
    requestedDays,
    actualDays: selected.length,
    startDate: cleanText(selected[0].date),
    endDate: cleanText(selected[selected.length - 1].date),
    ...totals,
  }
}

function buildInstitutionalTrend(rows) {
  const sorted = rows.filter((row) => cleanText(row.date)).sort((a, b) => cleanText(a.date).localeCompare(cleanText(b.date)))
  if (sorted.length === 0) return null
  return {
    asOf: cleanText(sorted[sorted.length - 1].date),
    windows: [aggregateInstitutional(sorted, 5), aggregateInstitutional(sorted, 20)].filter(Boolean),
  }
}

async function loadCompanySignals({ ticker, market }) {
  const today = dateKey(new Date())
  const requests = await Promise.allSettled([
    fetchFinMindDataset(DATASETS.revenue, ticker, yearsAgoStart(4), today),
    fetchFinMindDataset(DATASETS.balanceSheet, ticker, yearsAgoStart(2), today),
    fetchFinMindDataset(DATASETS.cashFlow, ticker, yearsAgoStart(2), today),
    fetchFinMindDataset(DATASETS.institutional, ticker, daysAgo(120), today),
  ])

  const value = (index) => requests[index].status === 'fulfilled' ? requests[index].value : []
  const errors = requests.flatMap((result, index) => result.status === 'rejected'
    ? [{ dataset: Object.values(DATASETS)[index], message: result.reason instanceof Error ? result.reason.message : '資料同步失敗' }]
    : [])

  const revenueTrend = buildRevenueTrend(value(0))
  const liquidity = buildLiquidity(value(1), value(2))
  const institutionalTrend = buildInstitutionalTrend(value(3))
  const availableSections = [revenueTrend, liquidity, institutionalTrend].filter(Boolean).length

  return {
    ticker,
    market,
    fetchedAt: new Date().toISOString(),
    status: availableSections === 3 ? 'official' : availableSections > 0 ? 'partial' : 'unavailable',
    source: { name: 'FinMind', url: 'https://finmindtrade.com/' },
    revenueTrend,
    liquidity,
    institutionalTrend,
    errors,
  }
}

export async function getCompanySignals({ ticker, market }) {
  const cacheKey = `${market}:${ticker}`
  const cached = signalCache.get(cacheKey)
  if (cached && Date.now() - cached.storedAt < SIGNAL_CACHE_MS) return cached.data

  const inflight = inflightSignals.get(cacheKey)
  if (inflight) return inflight

  const request = loadCompanySignals({ ticker, market })
    .then((data) => {
      signalCache.set(cacheKey, { storedAt: Date.now(), data })
      return data
    })
    .finally(() => inflightSignals.delete(cacheKey))

  inflightSignals.set(cacheKey, request)
  return request
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
    const result = await getCompanySignals({ ticker, market })
    response.setHeader('Cache-Control', 's-maxage=14400, stale-while-revalidate=1800')
    return response.status(200).json(result)
  } catch (error) {
    return response.status(502).json({
      error: error instanceof Error ? error.message : 'FinMind 公司觀察資料同步失敗',
    })
  }
}
