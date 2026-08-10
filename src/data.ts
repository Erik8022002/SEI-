import generatedCompanies from './generated/companies.json'

export type FinancialMetric = {
  label: string
  value: number
  delta: number
  suffix: string
  note: string
}

export type EventCategory = '技術投資' | '營運發展' | '公司治理' | '市場合作'

export type Event = {
  date: string
  category: EventCategory
  title: string
  summary: string
  impact: '正向' | '中性' | '留意'
}

export type HistoricalEvent = {
  date: string
  category: EventCategory
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

  const source = raw as Partial<Company> & Record<string, unknown> & { code?: unknown }
  const id = String(source.id || source.ticker || source['公司代號'] || `company-${Math.random().toString(36).slice(2, 9)}`)
  const name = String(source.name || source['公司名稱'] || source['公司簡稱'] || DEFAULT_COMPANY.name)
  const englishName = String(source.englishName || source['英文簡稱'] || '')
  const website = String(source.website || source['網址'] || '')
  const ticker = String(source.ticker || source['公司代號'] || source.code || '')
  const taxId = String(source.taxId || source['營利事業統一編號'] || '')
  const industry = String(source.industry || source['產業別'] || DEFAULT_COMPANY.industry)
  const market = String(source.market || (source['上市日期'] ? '上市' : '上櫃') || DEFAULT_COMPANY.market)
  const location = String(source.location || source['住址'] || '')
  const founded = String(source.founded || source['成立日期'] || '')
  const employees = String(source.employees || '')
  const capital = String(source.capital || source['實收資本額'] || '')
  const score = typeof source.score === 'number' ? source.score : 0
  const scoreLabel = String(source.scoreLabel || (source.score ? `綜合得分 ${source.score}` : DEFAULT_COMPANY.scoreLabel))
  const summary = String(source.summary || DEFAULT_COMPANY.summary)

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
    updatedAt: String(source.updatedAt || DEFAULT_COMPANY.updatedAt),
    summary,
    metrics: Array.isArray(source.metrics) ? source.metrics.map(normalizeMetric) : [],
    strategyMetrics: Array.isArray(source.strategyMetrics) ? source.strategyMetrics : [],
    scores: Array.isArray(source.scores) ? source.scores : [],
    trend: Array.isArray(source.trend) ? source.trend : [],
    events: [],
    historicalEvents: Array.isArray(source.historicalEvents) ? source.historicalEvents as HistoricalEvent[] : [],
    opportunities: Array.isArray(source.opportunities) ? source.opportunities : [],
    risks: Array.isArray(source.risks) ? source.risks : [],
    questions: Array.isArray(source.questions) ? source.questions : [],
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
