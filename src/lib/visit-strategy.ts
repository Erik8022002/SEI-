import type { Company, Event as MaterialEvent } from '@/data'

export type VisitStrategyOpportunity = {
  signal: string
  need: string
  product: string
  rationale: string
  validationQuestion: string
}

export type VisitStrategyCard = {
  executiveSummary: string
  opportunities: VisitStrategyOpportunity[]
  risks: string[]
  questions: string[]
  opening: string
  evidence: string[]
}

type GenerateVisitStrategyOptions = {
  apiBaseUrl: string
  projectId: string
  projectToken: string
  sessionId?: string | null
  company: Company
  currentEvents: MaterialEvent[]
  conferenceSummaries?: string[]
}

export type GenerateVisitStrategyResult = {
  sessionId: string
  card: VisitStrategyCard
  rawText: string
}

type EapCreateResponse = {
  insertedId?: string
  id?: string
  chatId?: string
  data?: { insertedId?: string }
}

function cleanText(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeStringList(value: unknown, max = 6) {
  if (!Array.isArray(value)) return []
  return value.map(cleanText).filter(Boolean).slice(0, max)
}

function normalizeOpportunity(value: unknown): VisitStrategyOpportunity | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  const signal = cleanText(item.signal)
  const need = cleanText(item.need)
  const product = cleanText(item.product)
  const rationale = cleanText(item.rationale)
  const validationQuestion = cleanText(item.validationQuestion ?? item.validation_question ?? item.verify)

  if (![signal, need, product, rationale, validationQuestion].some(Boolean)) return null
  return { signal, need, product, rationale, validationQuestion }
}

function extractJsonCandidate(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim()
  if (fenced) return fenced

  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) return text.slice(start, end + 1)
  return text.trim()
}

function parseVisitStrategy(text: string): VisitStrategyCard {
  let parsed: unknown
  try {
    parsed = JSON.parse(extractJsonCandidate(text))
  } catch {
    throw new Error('AI 已回覆，但戰略卡格式無法解析，請重新生成')
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AI 回傳的戰略卡內容格式錯誤')
  }

  const raw = parsed as Record<string, unknown>
  const opportunities = Array.isArray(raw.opportunities)
    ? raw.opportunities.map(normalizeOpportunity).filter((item): item is VisitStrategyOpportunity => item !== null).slice(0, 3)
    : []

  if (opportunities.length === 0) {
    throw new Error('AI 未產生可用的商機假設，請重新生成')
  }

  const questions = normalizeStringList(raw.questions, 6)
  const validationQuestions = opportunities.map((item) => item.validationQuestion).filter(Boolean)

  return {
    executiveSummary: cleanText(raw.executiveSummary ?? raw.executive_summary ?? raw.summary),
    opportunities,
    risks: normalizeStringList(raw.risks, 6),
    questions: (questions.length > 0 ? questions : validationQuestions).slice(0, 6),
    opening: cleanText(raw.opening ?? raw.openingScript ?? raw.opening_script),
    evidence: normalizeStringList(raw.evidence ?? raw.evidenceNotes ?? raw.evidence_notes, 8),
  }
}

function buildPrompt(company: Company, currentEvents: MaterialEvent[], conferenceSummaries: string[]) {
  const metrics = company.strategyMetrics.length > 0
    ? company.strategyMetrics.map((metric) => `${metric.label}=${metric.value}（${metric.note}）`).join('；')
    : company.metrics.map((metric) => `${metric.label}=${metric.value}${metric.suffix}（${metric.note}，變動 ${metric.delta}%）`).join('；')

  const recentEvents = currentEvents.slice(0, 10).map((event) =>
    `${event.date}｜${event.category}｜${event.title}｜${event.summary}`,
  )
  const historicalEvents = company.historicalEvents.slice(0, 12).map((event) =>
    `${event.date}｜${event.category}｜${event.title}｜${event.summary}`,
  )

  return `你是企業金融 AO 的拜訪前研究助理。請針對「${company.name}（${company.ticker}，${company.market}）」產生一張可直接帶去拜訪的戰略卡。

任務目的：不是做投資建議，而是把企業公開資訊與資料庫內容轉成可驗證的企金融資／現金管理／避險／設備投資等商機假設。

請務必遵守：
1. 優先使用你可檢索到的結構化與非結構化資料；若資料不足，不得把推測寫成既定事實。
2. 每個商機都要按照「事件或財務訊號 → 可能需求 → 產品方向 → 判斷依據 → AO 驗證問題」呈現。
3. 產品方向必須優先依資料庫中的「需求－產品關係」或既有企金產品資料。若無法確認對應產品，product 請填「待 AO 驗證」，不要自行發明產品名稱。
4. 商機最多 3 個，依拜訪優先級排序。
5. 風險要描述會讓 AO 暫緩、改問法或需進一步查證的事項。
6. opening 必須自然、專業，不要直接斷言客戶有資金缺口。
7. evidence 只列本次判斷實際使用到的訊號或資料，不要杜撰來源。
8. 僅輸出 JSON，不要 Markdown、不要解釋。

前端目前可提供的公司脈絡：
- 公司：${company.name}／${company.ticker}
- 產業：${company.industry || '未提供'}
- 公司摘要：${company.summary || '未提供'}
- 財務指標：${metrics || '前端暫無可用指標，請以資料庫檢索為主'}
- 近兩週重大事件：${recentEvents.length > 0 ? recentEvents.join('；') : '前端目前無事件，請以資料庫檢索為主'}
- 歷史事件：${historicalEvents.length > 0 ? historicalEvents.join('；') : '前端目前無事件'}
- 近期法說：${conferenceSummaries.length > 0 ? conferenceSummaries.join('；') : '前端目前無法說摘要'}

JSON 格式必須完全符合：
{
  "executiveSummary": "一句話說明本次拜訪核心",
  "opportunities": [
    {
      "signal": "具體事件／財務訊號，盡可能含日期或數字",
      "need": "可能需求，請使用假設語氣",
      "product": "對應企金產品方向",
      "rationale": "為何由此訊號推導出這個需求與產品",
      "validationQuestion": "AO 拜訪時要如何驗證"
    }
  ],
  "risks": ["風險或待查證事項"],
  "questions": ["建議拜訪問題"],
  "opening": "建議開場話術",
  "evidence": ["本次實際使用的資料訊號"]
}`
}

async function createSession(apiBaseUrl: string, headers: HeadersInit, title: string) {
  const response = await fetch(`${apiBaseUrl}create`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`建立 AI Session 失敗（HTTP ${response.status}）：${detail.slice(0, 180)}`)
  }

  const payload = await response.json() as EapCreateResponse
  const sessionId = payload.insertedId ?? payload.data?.insertedId ?? payload.id ?? payload.chatId
  if (!sessionId) throw new Error('AI Session 建立成功，但伺服器未回傳 Chat ID')
  return sessionId
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
      // Ignore malformed partial SSE lines. The endpoint may still provide a final result later.
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

export async function generateVisitStrategyCard(options: GenerateVisitStrategyOptions): Promise<GenerateVisitStrategyResult> {
  const headers: HeadersInit = {
    Authorization: `Bearer ${options.projectToken}`,
    'x-application-tenant': options.projectId,
    'Content-Type': 'application/json',
  }

  const sessionId = options.sessionId || await createSession(
    options.apiBaseUrl,
    headers,
    `${options.company.name} ${options.company.ticker} 拜訪戰略`,
  )

  const prompt = buildPrompt(options.company, options.currentEvents, options.conferenceSummaries ?? [])
  const response = await fetch(`${options.apiBaseUrl}${sessionId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ q: prompt, streaming: true }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`拜訪戰略生成失敗（HTTP ${response.status}）：${detail.slice(0, 180)}`)
  }

  const rawResponse = await response.text()
  const rawText = parseSseText(rawResponse)
  if (!rawText) throw new Error('AI 未回傳拜訪戰略內容')

  return {
    sessionId,
    card: parseVisitStrategy(rawText),
    rawText,
  }
}

export function visitStrategyToText(company: Company, card: VisitStrategyCard, selectedMetrics: Company['strategyMetrics']) {
  const lines = [
    `【${company.name}｜拜訪戰略卡】`,
    `股票代碼：${company.ticker}（${company.market}）`,
    `生成時間：${new Date().toLocaleString('zh-TW')}`,
    '',
    `拜訪核心：${card.executiveSummary || '—'}`,
    `財務快照：${selectedMetrics.length > 0 ? selectedMetrics.map((metric) => `${metric.label} ${metric.value}`).join('；') : '前端暫無可用指標'}`,
    '',
    '【優先商機】',
    ...card.opportunities.flatMap((item, index) => [
      `${index + 1}. ${item.need || '待驗證需求'}`,
      `   訊號：${item.signal || '—'}`,
      `   產品方向：${item.product || '待 AO 驗證'}`,
      `   判斷依據：${item.rationale || '—'}`,
      `   驗證問題：${item.validationQuestion || '—'}`,
    ]),
    '',
    '【風險與待查證】',
    ...(card.risks.length > 0 ? card.risks.map((item) => `- ${item}`) : ['- 無額外風險項目']),
    '',
    '【建議提問】',
    ...(card.questions.length > 0 ? card.questions.map((item) => `- ${item}`) : ['- 請依商機驗證問題進行訪談']),
    '',
    '【建議開場】',
    card.opening || '—',
    '',
    '【判斷依據】',
    ...(card.evidence.length > 0 ? card.evidence.map((item) => `- ${item}`) : ['- AI 未列出額外依據']),
    '',
    '本內容為拜訪前需求假設，應由 AO 與客戶訪談及內部資料進一步驗證。',
  ]

  return lines.join('\n')
}
