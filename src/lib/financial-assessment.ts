import type { Company } from '@/data'

export type FinancialAssessmentMetricSet = {
  revenueGrowthPct: number | null
  grossMarginPct: number | null
  operatingMarginPct: number | null
  netMarginPct: number | null
  currentRatio: number | null
  debtRatioPct: number | null
  operatingCashFlow: number | null
  netIncome: number | null
}

export type FinancialAssessmentDimension = {
  label: '獲利與成長' | '償債結構' | '流動性' | '現金流品質'
  score: number | null
  note: string
}

export type FinancialAssessmentCard = {
  score: number | null
  label: string
  dataStatus: 'sufficient' | 'partial' | 'insufficient'
  completeness: number
  asOf: string
  summary: string
  dimensions: FinancialAssessmentDimension[]
  metrics: FinancialAssessmentMetricSet
  evidence: string[]
  notes: string[]
}

type FinancialAssessmentOptions = {
  apiBaseUrl: string
  projectId: string
  projectToken: string
  company: Company
}

type EapCreateResponse = {
  insertedId?: string
  id?: string
  chatId?: string
  data?: { insertedId?: string }
}

type RawAssessment = {
  asOf?: unknown
  metrics?: Record<string, unknown>
  evidence?: unknown
  notes?: unknown
}

function cleanText(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const normalized = cleanText(value).replace(/,/g, '').replace(/%$/, '')
  if (!normalized || /^(null|n\/a|na|--|無)$/i.test(normalized)) return null
  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

function normalizeList(value: unknown, max = 8) {
  if (!Array.isArray(value)) return []
  return value.map(cleanText).filter(Boolean).slice(0, max)
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function scoreGrowth(value: number) {
  if (value <= -20) return 20
  if (value < -5) return 40
  if (value < 5) return 60
  if (value < 15) return 75
  if (value < 30) return 88
  return 95
}

function scoreNetMargin(value: number) {
  if (value < 0) return 20
  if (value < 3) return 45
  if (value < 8) return 65
  if (value < 15) return 80
  return 90
}

function scoreDebtRatio(value: number) {
  if (value <= 35) return 90
  if (value <= 50) return 80
  if (value <= 65) return 65
  if (value <= 80) return 45
  return 25
}

function scoreCurrentRatio(value: number) {
  if (value < 0.8) return 25
  if (value < 1) return 45
  if (value < 1.2) return 60
  if (value < 1.5) return 75
  if (value <= 2.5) return 90
  return 85
}

function scoreCashFlow(operatingCashFlow: number, netIncome: number | null) {
  if (operatingCashFlow < 0) return 25
  if (netIncome === null || netIncome <= 0) return 65
  const conversion = operatingCashFlow / netIncome
  if (conversion >= 1.2) return 95
  if (conversion >= 0.8) return 85
  if (conversion >= 0.5) return 70
  if (conversion > 0) return 55
  return 30
}

function average(values: Array<number | null>) {
  const available = values.filter((value): value is number => value !== null)
  if (available.length === 0) return null
  return clampScore(available.reduce((sum, value) => sum + value, 0) / available.length)
}

function formatPct(value: number | null) {
  return value === null ? '無資料' : `${value.toFixed(1)}%`
}

function formatRatio(value: number | null) {
  return value === null ? '無資料' : `${value.toFixed(2)}x`
}

function buildAssessment(raw: RawAssessment): FinancialAssessmentCard {
  const source = raw.metrics ?? {}
  const metrics: FinancialAssessmentMetricSet = {
    revenueGrowthPct: toNullableNumber(source.revenueGrowthPct),
    grossMarginPct: toNullableNumber(source.grossMarginPct),
    operatingMarginPct: toNullableNumber(source.operatingMarginPct),
    netMarginPct: toNullableNumber(source.netMarginPct),
    currentRatio: toNullableNumber(source.currentRatio),
    debtRatioPct: toNullableNumber(source.debtRatioPct),
    operatingCashFlow: toNullableNumber(source.operatingCashFlow),
    netIncome: toNullableNumber(source.netIncome),
  }

  const profitabilityScore = average([
    metrics.revenueGrowthPct === null ? null : scoreGrowth(metrics.revenueGrowthPct),
    metrics.netMarginPct === null ? null : scoreNetMargin(metrics.netMarginPct),
  ])
  const leverageScore = metrics.debtRatioPct === null ? null : scoreDebtRatio(metrics.debtRatioPct)
  const liquidityScore = metrics.currentRatio === null ? null : scoreCurrentRatio(metrics.currentRatio)
  const cashFlowScore = metrics.operatingCashFlow === null
    ? null
    : scoreCashFlow(metrics.operatingCashFlow, metrics.netIncome)

  const dimensions: FinancialAssessmentDimension[] = [
    {
      label: '獲利與成長',
      score: profitabilityScore,
      note: `營收成長 ${formatPct(metrics.revenueGrowthPct)}；淨利率 ${formatPct(metrics.netMarginPct)}`,
    },
    {
      label: '償債結構',
      score: leverageScore,
      note: `負債比 ${formatPct(metrics.debtRatioPct)}`,
    },
    {
      label: '流動性',
      score: liquidityScore,
      note: `流動比率 ${formatRatio(metrics.currentRatio)}`,
    },
    {
      label: '現金流品質',
      score: cashFlowScore,
      note: metrics.operatingCashFlow === null
        ? '營業現金流無資料'
        : `${metrics.operatingCashFlow >= 0 ? '營業現金流為正' : '營業現金流為負'}${metrics.netIncome !== null && metrics.netIncome > 0 ? `；現金獲利轉換 ${(metrics.operatingCashFlow / metrics.netIncome).toFixed(2)}x` : ''}`,
    },
  ]

  const availableDimensions = dimensions.filter((item) => item.score !== null)
  const score = availableDimensions.length >= 3
    ? clampScore(availableDimensions.reduce((sum, item) => sum + (item.score ?? 0), 0) / availableDimensions.length)
    : null

  const coreMetricValues = [
    metrics.revenueGrowthPct,
    metrics.netMarginPct,
    metrics.currentRatio,
    metrics.debtRatioPct,
    metrics.operatingCashFlow,
  ]
  const availableCoreMetrics = coreMetricValues.filter((value) => value !== null).length
  const completeness = Math.round((availableCoreMetrics / coreMetricValues.length) * 100)
  const dataStatus: FinancialAssessmentCard['dataStatus'] = score === null
    ? 'insufficient'
    : availableDimensions.length === 4 && completeness >= 80
      ? 'sufficient'
      : 'partial'

  let label = '資料不足'
  if (score !== null) {
    if (score >= 80) label = '財務體質穩健'
    else if (score >= 65) label = '財務體質尚穩'
    else if (score >= 50) label = '財務體質需關注'
    else label = '財務壓力偏高'
    if (dataStatus === 'partial') label += '（部分資料）'
  }

  const scored = availableDimensions.slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  const strongest = scored[0]
  const weakest = scored.at(-1)
  const summary = score === null
    ? '目前可驗證的財務構面不足 3 項，因此不產生總分，避免把資料缺口誤判為財務風險。'
    : `${strongest ? `${strongest.label}相對較佳` : '已有可用財務資料'}${weakest && weakest.label !== strongest?.label ? `，${weakest.label}為目前較需關注構面` : ''}。本分數採固定絕對門檻，非同業百分位。`

  return {
    score,
    label,
    dataStatus,
    completeness,
    asOf: cleanText(raw.asOf) || '最新可驗證期間',
    summary,
    dimensions,
    metrics,
    evidence: normalizeList(raw.evidence),
    notes: normalizeList(raw.notes),
  }
}

function extractJsonCandidate(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim()
  if (fenced) return fenced
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) return text.slice(start, end + 1)
  return text.trim()
}

function parseRawAssessment(text: string): RawAssessment {
  try {
    const parsed = JSON.parse(extractJsonCandidate(text))
    if (!parsed || typeof parsed !== 'object') throw new Error('not object')
    return parsed as RawAssessment
  } catch {
    throw new Error('AI 已回覆，但財務評估資料格式無法解析')
  }
}

async function createSession(apiBaseUrl: string, headers: HeadersInit, title: string) {
  const response = await fetch(`${apiBaseUrl}create`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title }),
  })
  if (!response.ok) throw new Error(`建立財務評估 Session 失敗（HTTP ${response.status}）`)
  const payload = await response.json() as EapCreateResponse
  const id = payload.insertedId ?? payload.data?.insertedId ?? payload.id ?? payload.chatId
  if (!id) throw new Error('財務評估 Session 未回傳 Chat ID')
  return id
}

function parseSseText(raw: string) {
  let finalResult = ''
  let chunks = ''
  let sawSse = false
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) continue
    sawSse = true
    const body = trimmed.replace(/^data:\s*/, '').trim()
    if (!body || body === '[DONE]') continue
    try {
      const parsed = JSON.parse(body) as { result?: unknown; chunk?: unknown }
      if (parsed.result !== undefined) finalResult = String(parsed.result)
      else if (parsed.chunk !== undefined) chunks += String(parsed.chunk)
    } catch {
      // Ignore malformed partial SSE lines; a complete result may arrive later.
    }
  }
  if (sawSse) return (finalResult || chunks).trim()
  try {
    const parsed = JSON.parse(raw) as { result?: unknown; data?: { result?: unknown }; answer?: unknown }
    return cleanText(parsed.result ?? parsed.data?.result ?? parsed.answer ?? raw)
  } catch {
    return raw.trim()
  }
}

function buildPrompt(company: Company) {
  return `你是企業金融 AO 的財務資料抽取助理。請針對「${company.name}（${company.ticker}）」從已匯入資料庫中的財務指標、綜合損益表、資產負債表、現金流量表與月營收資料，抽取最新且期間一致、可驗證的財務數字。

這個任務不是投資評等，也不要自行給總分。前端會用固定規則計分；你只負責取數、必要的明確公式換算，以及標示證據。

規則：
1. 優先使用資料庫中的結構化財務資料；不得用一般常識或猜測補數字。
2. revenueGrowthPct 優先使用同期間年增率；不可混用單月與累計期間。
3. grossMarginPct = 營業毛利 / 營業收入 × 100；operatingMarginPct = 營業利益 / 營業收入 × 100；netMarginPct = 本期淨利 / 營業收入 × 100。若資料庫已有比率可直接採用。
4. currentRatio = 流動資產 / 流動負債；debtRatioPct = 負債總計 / 資產總計 × 100。
5. operatingCashFlow 使用現金流量表的「營業活動之淨現金流入（流出）」；netIncome 必須與 operatingCashFlow 使用相同累計期間，才能供前端判斷現金獲利轉換。
6. 若任一數值無法從資料庫驗證，必須填 null，不可估算。
7. evidence 每一項請寫「期間｜表別／指標｜使用的原始數字或比率」，最多 8 項。
8. 僅輸出 JSON，不要 Markdown、不要解釋文字。

JSON 必須完全符合：
{
  "asOf": "最新一致的財務期間，例如 2026Q2",
  "metrics": {
    "revenueGrowthPct": 12.3,
    "grossMarginPct": 18.2,
    "operatingMarginPct": 9.8,
    "netMarginPct": 7.5,
    "currentRatio": 1.66,
    "debtRatioPct": 51.9,
    "operatingCashFlow": 123456,
    "netIncome": 98765
  },
  "evidence": ["2026Q2｜資產負債表｜流動資產 ...、流動負債 ..."],
  "notes": ["資料期間或口徑需要 AO 留意的事項"]
}

沒有資料的欄位一律輸出 null。數值欄位不要附 %, x, 元或逗號。`
}

export async function generateFinancialAssessment(options: FinancialAssessmentOptions): Promise<FinancialAssessmentCard> {
  const headers: HeadersInit = {
    Authorization: `Bearer ${options.projectToken}`,
    'x-application-tenant': options.projectId,
    'Content-Type': 'application/json',
  }
  const sessionId = await createSession(
    options.apiBaseUrl,
    headers,
    `${options.company.name} ${options.company.ticker} 財務綜合評估`,
  )
  const response = await fetch(`${options.apiBaseUrl}${sessionId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ q: buildPrompt(options.company), streaming: true }),
  })
  if (!response.ok) throw new Error(`財務評估資料查詢失敗（HTTP ${response.status}）`)
  const rawText = parseSseText(await response.text())
  if (!rawText) throw new Error('AI 未回傳可用的財務評估資料')
  return buildAssessment(parseRawAssessment(rawText))
}
