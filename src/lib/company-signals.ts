import type { Company } from '@/data'

export type RevenueYear = {
  year: number
  revenue: number
  yoy: number | null
}

export type LiquiditySignals = {
  reportDate: string
  cashFlowDate: string | null
  currentAssets: number
  currentLiabilities: number
  workingCapital: number
  currentRatio: number | null
  shortTermDebt: number | null
  shortTermFinancingRatio: number | null
  operatingCashFlow: number | null
  cashFlowRatio: number | null
}

export type InstitutionalWindow = {
  requestedDays: number
  actualDays: number
  startDate: string
  endDate: string
  foreign: number
  investmentTrust: number
  dealer: number
  total: number
}

export type CompanySignals = {
  ticker: string
  market: string
  fetchedAt: string
  status: 'official' | 'partial' | 'unavailable'
  source: { name: string; url: string }
  revenueTrend: {
    years: RevenueYear[]
    consecutiveGrowth: boolean | null
  } | null
  liquidity: LiquiditySignals | null
  institutionalTrend: {
    asOf: string
    windows: InstitutionalWindow[]
  } | null
  errors: Array<{ dataset: string; message: string }>
}

export type CompanySignalsState = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  data: CompanySignals | null
  message: string
}

export async function fetchCompanySignals(company: Company, signal: AbortSignal) {
  const params = new URLSearchParams({ ticker: company.ticker, market: company.market })
  const response = await fetch(`/api/company-signals?${params}`, {
    cache: 'no-store',
    signal,
  })
  const payload = await response.json() as CompanySignals & { error?: string }
  if (!response.ok) throw new Error(payload.error || `FinMind 公司觀察資料同步失敗：${response.status}`)
  return payload
}
