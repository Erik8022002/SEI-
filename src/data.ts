import generatedCompanies from './generated/companies.json'

export type FinancialMetric = {
  label: string
  value: number
  delta: number
  suffix: string
  note: string
}

export type Event = {
  date: string
  category: '財務' | '營運' | '治理' | '市場'
  title: string
  summary: string
  impact: '正向' | '中性' | '留意'
}

export type HistoricalEvent = {
  date: string
  category: '技術投資' | '營運發展' | '公司治理' | '市場合作'
  title: string
  summary: string
}

export type Company = {
  id: string
  name: string
  englishName: string
  website: string
  ticker: string
  taxId: string
  industry: string
  market: string
  location: string
  founded: string
  employees: string
  capital: string
  score: number
  scoreLabel: string
  updatedAt: string
  summary: string
  metrics: FinancialMetric[]
  strategyMetrics: { id: string; label: string; value: string; note: string }[]
  scores: { label: string; value: number }[]
  trend: { quarter: string; revenue: number; profit: number }[]
  events: Event[]
  historicalEvents: HistoricalEvent[]
  opportunities: string[]
  risks: string[]
  questions: string[]
}

const DEFAULT_COMPANY: Company = {
  id: '',
  name: '未命名企業',
  englishName: '',
  website: '',
  ticker: '',
  taxId: '',
  industry: '未分類',
  market: '上市',
  location: '',
  founded: '',
  employees: '0',
  capital: '0',
  score: 0,
  scoreLabel: '暫無評分',
  updatedAt: new Date().toLocaleString('zh-TW', { hour12: false }),
  summary: '無公司簡介資料',
  metrics: [],
  strategyMetrics: [],
  scores: [],
  trend: [],
  events: [],
  historicalEvents: [],
  opportunities: [],
  risks: [],
  questions: [],
}

function normalizeMetric(metric: Partial<FinancialMetric>): FinancialMetric {
  return {
    label: String(metric.label || '指標'),
    value: Number(metric.value) || 0,
    delta: Number(metric.delta) || 0,
    suffix: String(metric.suffix || ''),
    note: String(metric.note || ''),
  }
}

export function normalizeCompany(raw: Partial<Company> | Record<string, unknown>): Company {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_COMPANY, id: `company-${Date.now()}` }

  const id = String(raw.id || raw.ticker || raw['公司代號'] || `company-${Math.random().toString(36).slice(2, 9)}`)
  const name = String(raw.name || raw['公司名稱'] || raw['公司簡稱'] || DEFAULT_COMPANY.name)
  const englishName = String(raw.englishName || raw['英文簡稱'] || '')
  const website = String(raw.website || raw['網址'] || '')
  const ticker = String(raw.ticker || raw['公司代號'] || raw.code || '')
  const taxId = String(raw.taxId || raw['營利事業統一編號'] || '')
  const industry = String(raw.industry || raw['產業別'] || DEFAULT_COMPANY.industry)
  const market = String(raw.market || (raw['上市日期'] ? '上市' : '上櫃') || DEFAULT_COMPANY.market)
  const location = String(raw.location || raw['住址'] || '')
  const founded = String(raw.founded || raw['成立日期'] || '')
  const employees = String(raw.employees || '')
  const capital = String(raw.capital || raw['實收資本額'] || '')
  const score = typeof raw.score === 'number' ? raw.score : 0
  const scoreLabel = String(raw.scoreLabel || (raw.score ? `綜合得分 ${raw.score}` : DEFAULT_COMPANY.scoreLabel))
  const updatedAt = String(raw.updatedAt || DEFAULT_COMPANY.updatedAt)
  const summary = String(raw.summary || DEFAULT_COMPANY.summary)

  return {
    ...DEFAULT_COMPANY,
    id,
    name,
    englishName,
    website,
    ticker,
    taxId,
    industry,
    market,
    location,
    founded,
    employees,
    capital,
    score,
    scoreLabel,
    updatedAt: String(raw.updatedAt || DEFAULT_COMPANY.updatedAt),
    summary,
    metrics: Array.isArray(raw.metrics) ? raw.metrics.map(normalizeMetric) : [],
    strategyMetrics: Array.isArray(raw.strategyMetrics) ? raw.strategyMetrics : [],
    scores: Array.isArray(raw.scores) ? raw.scores : [],
    trend: Array.isArray(raw.trend) ? raw.trend : [],
    events: Array.isArray(raw.events) ? raw.events : [],
    historicalEvents: Array.isArray(raw.historicalEvents) ? raw.historicalEvents : [],
    opportunities: Array.isArray(raw.opportunities) ? raw.opportunities : [],
    risks: Array.isArray(raw.risks) ? raw.risks : [],
    questions: Array.isArray(raw.questions) ? raw.questions : [],
  }
}

export function transformCompList(list: Array<Record<string, unknown>>): Company[] {
  if (!Array.isArray(list)) return []
  return list.map((item) => normalizeCompany(item))
}

export const companies: Company[] = Array.isArray(generatedCompanies) && generatedCompanies.length > 0
  ? transformCompList(generatedCompanies)
  : []

export const suggestedSearches = ['2330', '鴻海', '53943057']
