import type { Company, FinancialMetric } from '@/data'

type TwseRawRow = Record<string, string | undefined>

export type TwseCompanyProfile = {
  queryName: string
  resolvedName: string
  ticker: string
  company: Partial<Company> & {
    metrics?: FinancialMetric[]
  }
  fetchedAt?: string
  source?: string
  sourceUrl?: string
}

function cleanText(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeName(value: unknown) {
  return cleanText(value)
    .replace(/臺/g, '台')
    .replace(/股份有限公司|有限公司|控股公司|控股/g, '')
    .replace(/[\s・·.()（）-]/g, '')
    .toLowerCase()
}

function toNumber(value: unknown) {
  const normalized = cleanText(value).replace(/,/g, '')
  if (!normalized || normalized === '--' || normalized === 'N/A') return null
  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

function formatRocDate(value: unknown) {
  const digits = cleanText(value).replace(/\D/g, '')
  if (digits.length !== 7) return cleanText(value)
  return `${Number(digits.slice(0, 3)) + 1911}-${digits.slice(3, 5)}-${digits.slice(5, 7)}`
}

function formatCapital(value: unknown) {
  const capital = toNumber(value)
  return capital === null ? '' : `${(capital / 100000000).toLocaleString('zh-TW', { maximumFractionDigits: 2 })} 億元`
}

function revenueInBillions(value: unknown) {
  const number = toNumber(value)
  return number === null ? null : number / 100000
}

function findBasicRow(rows: TwseRawRow[], name: string, ticker: string) {
  const normalizedQuery = normalizeName(name)
  return rows.find((row) => [row['公司名稱'], row['公司簡稱']].some((value) => normalizeName(value) === normalizedQuery))
    ?? rows.find((row) => [row['公司名稱'], row['公司簡稱']].some((value) => {
      const candidate = normalizeName(value)
      return candidate && (candidate.includes(normalizedQuery) || normalizedQuery.includes(candidate))
    }))
    ?? rows.find((row) => cleanText(row['公司代號']) === ticker)
}

function buildDevProfile(name: string, ticker: string, companyRows: TwseRawRow[], revenueRows: TwseRawRow[], tradingRows: TwseRawRow[], valuationRows: TwseRawRow[]): TwseCompanyProfile | null {
  const basicRow = findBasicRow(companyRows, name, ticker)
  if (!basicRow) return null
  const resolvedTicker = cleanText(basicRow['公司代號'])
  const revenueRow = revenueRows.find((row) => cleanText(row['公司代號']) === resolvedTicker)
  const tradingRow = tradingRows.find((row) => cleanText(row.Code) === resolvedTicker)
  const valuationRow = valuationRows.find((row) => cleanText(row.Code) === resolvedTicker)
  const industry = cleanText(revenueRow?.['產業別']) || cleanText(basicRow['產業別'])
  const companyName = cleanText(basicRow['公司名稱'])
  const shortName = cleanText(basicRow['公司簡稱'])
  const yearMonth = cleanText(revenueRow?.['資料年月'])
  const monthlyRevenue = revenueInBillions(revenueRow?.['營業收入-當月營收'])
  const cumulativeRevenue = revenueInBillions(revenueRow?.['累計營業收入-當月累計營收'])
  const peRatio = toNumber(valuationRow?.PEratio)
  const dividendYield = toNumber(valuationRow?.DividendYield)
  const pbRatio = toNumber(valuationRow?.PBratio)
  const metrics: FinancialMetric[] = []

  if (monthlyRevenue !== null) metrics.push({ label: '最新月營收', value: monthlyRevenue, delta: toNumber(revenueRow?.['營業收入-去年同月增減(%)']) ?? 0, suffix: '億元', note: `${yearMonth || '最新月份'} · 年增率` })
  if (cumulativeRevenue !== null) metrics.push({ label: '本年累計營收', value: cumulativeRevenue, delta: toNumber(revenueRow?.['累計營業收入-前期比較增減(%)']) ?? 0, suffix: '億元', note: `${yearMonth || '最新月份'} · 累計年增率` })
  if (peRatio !== null) metrics.push({ label: '本益比', value: peRatio, delta: 0, suffix: '倍', note: 'TWSE 每日估值' })
  if (dividendYield !== null) metrics.push({ label: '殖利率', value: dividendYield, delta: 0, suffix: '%', note: 'TWSE 每日估值' })

  return {
    queryName: name,
    resolvedName: companyName,
    ticker: resolvedTicker,
    fetchedAt: new Date().toISOString(),
    source: 'Taiwan Stock Exchange OpenAPI',
    sourceUrl: 'https://openapi.twse.com.tw/',
    company: {
      name: companyName,
      englishName: cleanText(basicRow['英文簡稱']),
      website: cleanText(basicRow['網址']),
      ticker: resolvedTicker,
      taxId: cleanText(basicRow['營利事業統一編號']),
      industry,
      market: '上市',
      location: cleanText(basicRow['住址']),
      founded: cleanText(basicRow['成立日期']).slice(0, 4),
      capital: formatCapital(basicRow['實收資本額']),
      updatedAt: formatRocDate(revenueRow?.['出表日期'] || tradingRow?.Date || basicRow['出表日期']),
      summary: `${shortName || companyName}為臺灣證券交易所上市公司，產業分類為${industry || '未分類'}；本頁基本資料與市場指標已由 TWSE OpenAPI 更新。`,
      metrics,
      strategyMetrics: [
        monthlyRevenue === null ? null : { id: 'revenue', label: '最新月營收', value: `${monthlyRevenue.toLocaleString('zh-TW', { maximumFractionDigits: 1 })} 億元`, note: 'TWSE 月營收' },
        peRatio === null ? null : { id: 'peRatio', label: '本益比', value: `${peRatio} 倍`, note: 'TWSE 每日估值' },
        dividendYield === null ? null : { id: 'dividendYield', label: '殖利率', value: `${dividendYield}%`, note: 'TWSE 每日估值' },
        pbRatio === null ? null : { id: 'pbRatio', label: '股價淨值比', value: `${pbRatio} 倍`, note: 'TWSE 每日估值' },
      ].filter((item): item is NonNullable<typeof item> => item !== null),
    },
  }
}

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', signal })
  if (!response.ok) throw new Error(`官方公司資料同步失敗：${response.status}`)
  return response.json() as Promise<T>
}

export async function fetchTwseCompanyByName(company: Company, signal: AbortSignal) {
  if (company.market !== '上市') return null

  if (import.meta.env.DEV) {
    const [companyRows, revenueRows, tradingRows, valuationRows] = await Promise.all([
      fetchJson<TwseRawRow[]>('/twse-openapi/v1/opendata/t187ap03_L', signal),
      fetchJson<TwseRawRow[]>('/twse-openapi/v1/opendata/t187ap05_L', signal),
      fetchJson<TwseRawRow[]>('/twse-openapi/v1/exchangeReport/STOCK_DAY_ALL', signal),
      fetchJson<TwseRawRow[]>('/twse-openapi/v1/exchangeReport/BWIBBU_ALL', signal),
    ])
    return buildDevProfile(company.name, company.ticker, companyRows, revenueRows, tradingRows, valuationRows)
  }

  const params = new URLSearchParams({ name: company.name, ticker: company.ticker })
  return fetchJson<TwseCompanyProfile>(`/api/twse-company?${params}`, signal)
}
