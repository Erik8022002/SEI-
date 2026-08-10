import { lazy, Suspense, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import {
  ArrowRight, Bot, Building2, CalendarDays,
  Check, ChevronDown, CircleAlert, Clock3, Copy, Download, ExternalLink,
  FileChartColumn, FileText, History, Landmark, MapPin, Menu, MessageSquareText,
  Presentation, RefreshCw, Search, Send, Sparkles, Target, TrendingUp,
  Video, X,
} from 'lucide-react'
import {
  companies as initialCompanies,
  suggestedSearches,
  type Company,
  type Event as MaterialEvent,
  type HistoricalEvent,
} from './data'
import conferenceData from './generated/investor-conferences.json'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { TwseMarketSnapshot } from './components/twse-market-snapshot'
import { fetchTwseCompanyByName } from './lib/twse-company'
import { fetchTwseHistoricalEvents, mergeTwseHistoricalEvents } from './lib/twse-historical-events'
import {
  fetchCompanySignals,
  type CompanySignals,
  type CompanySignalsState,
} from './lib/company-signals'

type RawConference = Record<string, unknown>
type ConferenceItem = {
  date: string
  time: string
  companyCode: string
  companyName: string
  market?: string
  summary: string
  location?: string
  presentationZh?: string
  videos: string[]
  website?: string
}

type ConferenceQueryState = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  message: string
  items: ConferenceItem[]
}

const rawConferences = (conferenceData as { conferences?: RawConference[] }).conferences ?? []
const conferences: ConferenceItem[] = rawConferences.map((c) => {
  const anyC = c as Record<string, unknown>
  const companyCode = String((anyC['公司代號'] ?? anyC['companyCode'] ?? anyC['code']) ?? '')
  const companyName = String((anyC['公司名稱'] ?? anyC['公司簡稱'] ?? anyC['companyName'] ?? anyC['name']) ?? '')
  const date = String((anyC['出表日期'] ?? anyC['date']) ?? '')
  const time = String((anyC['time'] ?? anyC['時間']) ?? '')
  const summary = String((anyC['summary'] ?? anyC['內容'] ?? anyC['簡介']) ?? '')
  const location = String((anyC['location'] ?? anyC['地點']) ?? '')
  const presentationZh = String((anyC['presentationZh'] ?? anyC['presentationZhUrl']) ?? '')
  const vids = anyC['videos']
  const videos = Array.isArray(vids) ? vids.map((v) => String(v)) : (vids ? [String(vids)] : [])
  const website = String((anyC['website'] ?? anyC['網址']) ?? '')
  const market = String((anyC['market'] ?? anyC['市場']) ?? '')
  return { date, time, companyCode, companyName, summary, location, presentationZh, videos, website, market }
})

const conferenceCompanies = ((conferenceData as unknown) as { companies?: Array<{ code: string; name: string; conferenceCount: number; group?: string; note?: string }> }).companies ?? []

const AdvancedStats = lazy(() => import('@/components/ui/advanced-stats'))
type EventMode = 'realtime' | 'history'
type EventSyncStatus = 'refreshing' | 'official' | 'fallback'
type CompanySyncStatus = 'idle' | 'loading' | 'official' | 'fallback'
type SearchHistoryItem = {
  id: string
  type: 'company' | 'conference'
  name: string
  code: string
  detail: string
  companyId?: string
  group?: string
  searchedAt: string
}

const MATERIAL_EVENT_REFRESH_MS = 4 * 60 * 60 * 1000
const SEARCH_HISTORY_KEY = 'compass-search-history-v1'

function buildMopsHistoricalNewsUrl(companyCode: string) {
  const query = new URLSearchParams({
    companyId: companyCode,
    year: String(new Date().getFullYear() - 1911),
    month: 'all',
  })

  return `https://mops.twse.com.tw/mops/#/web/t05st01?${query.toString()}`
}

function formatFinancialAmount(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '資料不足'
  const billions = value / 100000000
  return `${billions.toLocaleString('zh-TW', { maximumFractionDigits: Math.abs(billions) < 100 ? 1 : 0 })} 億元`
}

function formatSignalPercent(value: number | null) {
  return value === null || !Number.isFinite(value) ? '資料不足' : `${value.toLocaleString('zh-TW', { maximumFractionDigits: 1 })}%`
}

function formatNetLots(value: number) {
  const lots = value / 1000
  const sign = lots > 0 ? '+' : lots < 0 ? '−' : ''
  return `${sign}${Math.abs(lots).toLocaleString('zh-TW', { maximumFractionDigits: 1 })} 張`
}

function buildSignalsText(signals: CompanySignals | null) {
  if (!signals) return ['- FinMind 資料尚未載入']
  const lines: string[] = []

  if (signals.revenueTrend) {
    const values = signals.revenueTrend.years.map((item) => `${item.year} 年 ${formatFinancialAmount(item.revenue)}`).join('；')
    const growth = signals.revenueTrend.consecutiveGrowth === null
      ? '完整年度不足三年'
      : `連續成長：${signals.revenueTrend.consecutiveGrowth ? '是' : '否'}`
    lines.push(`- 近三年營收：${values}（${growth}）`)
  } else {
    lines.push('- 近三年營收：資料不足')
  }

  if (signals.liquidity) {
    const item = signals.liquidity
    lines.push(`- 週轉與短期融資（${item.reportDate}）：營運資金 ${formatFinancialAmount(item.workingCapital)}；流動比率 ${formatSignalPercent(item.currentRatio)}；短期融資占比 ${formatSignalPercent(item.shortTermFinancingRatio)}；現金流量比率 ${formatSignalPercent(item.cashFlowRatio)}`)
  } else {
    lines.push('- 週轉與短期融資：資料不足')
  }

  const institutional = signals.institutionalTrend?.windows.find((item) => item.requestedDays === 20)
  if (institutional) {
    lines.push(`- 三大法人最近 ${institutional.actualDays} 個交易日：合計 ${formatNetLots(institutional.total)}；外資 ${formatNetLots(institutional.foreign)}；投信 ${formatNetLots(institutional.investmentTrust)}；自營商 ${formatNetLots(institutional.dealer)}`)
  } else {
    lines.push('- 三大法人買賣趨勢：資料不足')
  }

  return lines
}

function readSearchHistory() {
  if (typeof window === 'undefined') return []
  try {
    const value = JSON.parse(window.localStorage.getItem(SEARCH_HISTORY_KEY) ?? '[]')
    return Array.isArray(value) ? value.slice(0, 6) as SearchHistoryItem[] : []
  } catch {
    return []
  }
}

function mergeMaterialEvents(official: MaterialEvent[], fallback: MaterialEvent[]) {
  const seen = new Set<string>()
  return [...official, ...fallback]
    .filter((event) => {
      const key = `${event.date}-${event.title}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => b.date.localeCompare(a.date))
}

function mergeHistoricalEvents(official: HistoricalEvent[], fallback: HistoricalEvent[]) {
  return mergeTwseHistoricalEvents(official, fallback)
}

function useMaterialEvents(company: Company) {
  const [eventState, setEventState] = useState<{ companyId: string; events: MaterialEvent[] }>({
    companyId: company.id,
    events: company.events,
  })
  const [status, setStatus] = useState<EventSyncStatus>('refreshing')
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const events = eventState.companyId === company.id ? eventState.events : company.events

  useEffect(() => {
    const controller = new AbortController()

    const sync = async () => {
      setStatus('refreshing')
      try {
        const params = new URLSearchParams({ ticker: company.ticker, market: company.market })
        const response = await fetch(`/api/material-events?${params}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`重大訊息同步失敗：${response.status}`)
        const payload = await response.json() as { events?: MaterialEvent[] }
        if (!Array.isArray(payload.events)) throw new Error('重大訊息資料格式錯誤')
        setEventState({ companyId: company.id, events: mergeMaterialEvents(payload.events, company.events) })
        setStatus('official')
      } catch {
        if (controller.signal.aborted) return
        setEventState({ companyId: company.id, events: company.events })
        setStatus('fallback')
      } finally {
        if (!controller.signal.aborted) setLastCheckedAt(new Date())
      }
    }

    void sync()
    const interval = window.setInterval(() => void sync(), MATERIAL_EVENT_REFRESH_MS)
    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [company, refreshToken])

  return {
    events,
    status,
    lastCheckedAt,
    refresh: () => setRefreshToken((value) => value + 1),
  }
}

function buildCompanyReport(company: Company, currentEvents: MaterialEvent[]) {
  const companyConferences = conferences.filter((item) => item.companyCode === company.ticker)
  const lines = [
    `# ${company.name}｜企業情報完整報告`,
    '',
    `匯出時間：${new Date().toLocaleString('zh-TW')}`,
    `資料更新：${company.updatedAt}`,
    '',
    '## 公司基本資料',
    `- 英文名稱：${company.englishName}`,
    `- 股票代碼：${company.ticker}（${company.market}）`,
    `- 統一編號：${company.taxId}`,
    `- 產業：${company.industry}`,
    `- 所在地：${company.location}`,
    `- 成立年份：${company.founded}`,
    `- 實收資本額：${company.capital}`,
    `- 官方網站：${company.website}`,
    '',
    '## 企業速覽',
    company.summary,
    '',
    '## 財務健診',
    `- 綜合評分：${company.score} / 100（${company.scoreLabel}）`,
    ...company.scores.map((score) => `- ${score.label}：${score.value}`),
    '',
    '## 核心財務指標',
    ...company.metrics.map((metric) => `- ${metric.label}：${metric.value.toLocaleString()}${metric.suffix}（${metric.note} ${metric.delta > 0 ? '+' : ''}${metric.delta}%）`),
    '',
    '## 近六季趨勢',
    ...company.trend.map((point) => `- ${point.quarter}：營收 ${point.revenue.toLocaleString()} 億元；稅後淨利 ${point.profit.toLocaleString()} 億元`),
    '',
    '## 即時與近期重大事件',
    ...(currentEvents.length > 0
      ? currentEvents.map((event) => `- ${event.date}｜${event.category}｜${event.title}｜${event.summary}｜影響：${event.impact}`)
      : ['- 本次同步無新增重大事件']),
    '',
    '## 歷史重大事件',
    ...company.historicalEvents.map((event) => `- ${event.date}｜${event.category}｜${event.title}｜${event.summary}`),
    '',
    '## 拜訪策略',
    '### 切入機會',
    ...company.opportunities.map((item) => `- ${item}`),
    '### 風險觀察',
    ...company.risks.map((item) => `- ${item}`),
    '### 建議提問',
    ...company.questions.map((item) => `- ${item}`),
    '',
    '## 法說會資料',
    ...(companyConferences.length > 0
      ? companyConferences.map((item) => `- ${item.date} ${item.time}｜${item.summary}｜${item.location}`)
      : ['- 目前法說會資料庫無此公司場次']),
    '',
    '---',
    '資料僅供參考，不構成任何投資或授信建議。',
  ]
  return lines.join('\n')
}

const API_BASE_URL = '/api-proxy/api/v1/chat/'
const PROJECT_ID = '6a439e510763de002d27d689'
const PROJECT_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhNzgzMTY3MDdmMmJiMDAyZGVmNWM1ZiIsImlzQVBJIjp0cnVlLCJnX3VpZCI6IjZhNDNhMDNiMDc2M2RlMDAyZDI3ZTA4YSIsImdfYWRtaW4iOmZhbHNlLCJnX2RlbW9hZG1pbiI6ZmFsc2UsImdfYWNjb3VudGFkbWluIjpmYWxzZSwiZ190aWQiOiI2YTQzOWU1MTA3NjNkZTAwMmQyN2Q2ODk6cHJvZHVjZXIiLCJnX3RpZF9wZXJtaXNzaW9uIjpbIm1ldGE6dXBkYXRlIiwic291cmNlOnJlYWQiLCJzb3VyY2U6dXBkYXRlIiwic291cmNlOmRlbGV0ZSIsImdyYXBoOnJlYWQiLCJncmFwaDp1cGRhdGUiLCJncmFwaDpkZWxldGUiLCJncmFwaDpleHBsb3JlIiwiZ3JhcGg6ZXhwb3J0IiwiY2FudmFzOmFubm90YXRlIiwiY2FudmFzOnBlcnNvbmFsaXplIiwiZGFzaGJvYXJkOnJlYWQiLCJkYXNoYm9hcmQ6dXBkYXRlIiwiY2FudmFzOnNoYXBlIl0sImdfdGlkX3BhcnNlcl9zb3VyY2UiOiJjc3YiLCJnX3RpZF9mZWF0dXJlX2FkZF9vbnMiOlsiYXNzaXN0YW50Il0sImdfYXZhdGFyIjoiMDIiLCJpc3MiOiJodHRwczovL2Nsb3VkLmdlbWluaWRhdGEuY29tIiwic3ViIjoiNmE0M2EwM2IwNzYzZGUwMDJkMjdlMDhhIiwiYXVkIjoiaHR0cHM6Ly9jbG91ZC5nZW1pbmlkYXRhLmNvbSIsImV4cCI6MTgxNzc5Nzg2MCwiaWF0IjoxNzg2MjYxODY0LCJuaWNrbmFtZSI6Im1lbWJlcjE2QDIwMjZzZWkuY29tIiwiZW1haWwiOiJtZW1iZXIxNkAyMDI2c2VpLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjpmYWxzZX0.WOkoTrEZYsjlSlm4q5WacZvH8alF6N17T6DhplRLhlA'
function App() {
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [companyList] = useState<Company[]>(initialCompanies)
  const [company, setCompany] = useState<Company>(initialCompanies[0])
  const [chatId, setChatId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>(readSearchHistory)
  const [eventMode, setEventMode] = useState<EventMode>('realtime')
  const [eventFilter, setEventFilter] = useState('全部')
  const [question, setQuestion] = useState('')
  const [chat, setChat] = useState<{ id?: string; role: 'user' | 'assistant'; text: string }[]>([])
  const [thinking, setThinking] = useState(false)
  const [strategyOpen, setStrategyOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [exported, setExported] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [strategyMetricIds, setStrategyMetricIds] = useState(['revenue', 'grossMargin', 'debtRatio', 'currentRatio', 'eps'])
  const [companySyncStatus, setCompanySyncStatus] = useState<CompanySyncStatus>('idle')
  const [companySignals, setCompanySignals] = useState<CompanySignalsState>({
    status: 'idle',
    data: null,
    message: '開啟戰略卡後同步 FinMind 真實資料',
  })
  const searchRef = useRef<HTMLDivElement>(null)
  const companyLookupControllerRef = useRef<AbortController | null>(null)
  const materialEvents = useMaterialEvents(company)

  useEffect(() => {
    if (!strategyOpen || !company.ticker || !['上市', '上櫃'].includes(company.market)) return
    const controller = new AbortController()

    setCompanySignals((current) => ({
      status: 'loading',
      data: current.data?.ticker === company.ticker ? current.data : null,
      message: '正在同步 FinMind 歷史財務與三大法人資料',
    }))

    void fetchCompanySignals(company, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setCompanySignals({
          status: 'ready',
          data,
          message: data.status === 'official' ? 'FinMind 真實資料已同步' : data.status === 'partial' ? '部分資料可用' : '目前查無可用資料',
        })
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setCompanySignals({
          status: 'error',
          data: null,
          message: error instanceof Error ? error.message : 'FinMind 資料同步失敗',
        })
      })

    return () => controller.abort()
  }, [strategyOpen, company.ticker, company.market])

  useEffect(() => {
    const controller = new AbortController()

    const syncHistoricalEvents = async () => {
      try {
        const payload = await fetchTwseHistoricalEvents(company, controller.signal)
        if (controller.signal.aborted || !payload?.events) return
        setCompany((current) => current.id === company.id ? {
          ...current,
          historicalEvents: mergeHistoricalEvents(payload.events, current.historicalEvents),
        } : current)
      } catch {
        if (controller.signal.aborted) return
      }
    }

    void syncHistoricalEvents()
    return () => controller.abort()
  }, [company.id, company.ticker, company.market])

  const profileResults = companyList.filter((item) =>
    [item.name, item.englishName, item.ticker, item.taxId].some((value) => value.toLowerCase().includes(query.toLowerCase())),
  )
  const conferenceResults = conferenceCompanies.filter((item: { name: string; code: string }) =>
    [item.name, item.code].some((value) => value.toLowerCase().includes(query.toLowerCase())),
  )
  const resultCount = profileResults.length + conferenceResults.length
  const eventFilters = eventMode === 'realtime'
    ? ['全部', '財務', '營運', '治理', '市場']
    : ['全部', '技術投資', '營運發展', '公司治理', '市場合作']
  const visibleEvents = eventFilter === '全部'
    ? materialEvents.events
    : materialEvents.events.filter((event) => event.category === eventFilter)
  const visibleHistoricalEvents = eventFilter === '全部'
    ? company.historicalEvents
    : company.historicalEvents.filter((event) => event.category === eventFilter)
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory))
    } catch {
      // Browsers may block storage in private or restricted modes.
    }
  }, [searchHistory])

  useEffect(() => () => companyLookupControllerRef.current?.abort(), [])

  const rememberSearch = (item: SearchHistoryItem) => {
    setSearchHistory((current) => [item, ...current.filter((entry) => entry.id !== item.id)].slice(0, 6))
  }

  const chooseCompany = (next: Company) => {
    rememberSearch({
      id: `company-${next.id}`,
      type: 'company',
      name: next.name,
      code: next.ticker,
      detail: `${next.market} · ${next.industry}`,
      companyId: next.id,
      searchedAt: new Date().toISOString(),
    })
    setCompany(next)
    companyLookupControllerRef.current?.abort()
    const controller = new AbortController()
    companyLookupControllerRef.current = controller
    setCompanySyncStatus(next.market === '上市' ? 'loading' : 'fallback')

    if (next.market === '上市') {
      void fetchTwseCompanyByName(next, controller.signal)
        .then((profile) => {
          if (controller.signal.aborted || !profile) {
            if (!controller.signal.aborted) setCompanySyncStatus('fallback')
            return
          }
          setCompany((current) => current.id === next.id ? {
            ...current,
            ...profile.company,
            id: current.id,
            events: current.events,
            historicalEvents: current.historicalEvents,
            trend: current.trend,
            scores: current.scores,
            opportunities: current.opportunities,
            risks: current.risks,
            questions: current.questions,
          } : current)
          setCompanySyncStatus('official')
          setStrategyMetricIds(profile.company.strategyMetrics?.map((metric) => metric.id).slice(0, 5) ?? ['revenue'])
        })
        .catch(() => {
          if (!controller.signal.aborted) setCompanySyncStatus('fallback')
        })
    }
    setQuery('')
    setSearchOpen(false)
    setChat([])
    setEventMode('realtime')
    setEventFilter('全部')
    setStrategyMetricIds(['revenue', 'grossMargin', 'debtRatio', 'currentRatio', 'eps'])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const chooseConferenceCompany = (next: { code: string; name: string; conferenceCount: number; group?: string; note?: string }) => {
    rememberSearch({
      id: `conference-${next.code}`,
      type: 'conference',
      name: next.name,
      code: next.code,
      detail: `法說資料 · ${next.conferenceCount} 場`,
      group: next.group,
      searchedAt: new Date().toISOString(),
    })
    setQuery('')
    setSearchOpen(false)
    window.dispatchEvent(new CustomEvent('select-conference-company', { detail: { code: next.code, group: next.group } }))
    document.getElementById('conferences')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const repeatSearch = (item: SearchHistoryItem) => {
    if (item.type === 'company') {
      const next = companyList.find((entry) => entry.id === item.companyId)
      if (next) chooseCompany(next)
      return
    }
    const next = conferenceCompanies.find((entry: { code: string; group?: string }) => entry.code === item.code && entry.group === item.group)
    if (next) chooseConferenceCompany(next)
  }

  const exportReport = async () => {
    
  }

  const ask = async (text = question) => {
    if (!text.trim() || thinking) return
    const prompt = text.trim()
    setQuestion('')

    const userMessageId = `user-${Date.now()}`
    const assistantMessageId = `assistant-${Date.now()}`

    setChat((current) => [
      ...current,
      { id: userMessageId, role: 'user', text: prompt },
      { id: assistantMessageId, role: 'assistant', text: '' },
    ])
    setThinking(true)

    // 1. 使用區域變數追蹤最新的 Chat ID，避免 React State 非同步落差
    let currentChatId = activeChatId || chatId

    try {
      const headers = {
        'Authorization': `Bearer ${PROJECT_TOKEN}`,
        'x-application-tenant': PROJECT_ID,
        'Content-Type': 'application/json',
      }

      // 2. 建立 Chat Session（如果當前沒有 ID）
      if (!currentChatId) {
        const createRes = await fetch(`${API_BASE_URL}create`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title: `Don`,
          }),
        })

        if (!createRes.ok) {
          const errText = await createRes.text()
          throw new Error(`建立 Session 失敗 (HTTP ${createRes.status}): ${errText}`)
        }

        const createData = await createRes.json()

        currentChatId =
          createData.insertedId ||
          createData.data?.insertedId ||
          createData.id ||
          createData.chatId

        if (!currentChatId) {
          throw new Error(`伺服器未回傳有效的 Chat ID，回傳內容：${JSON.stringify(createData)}`)
        }

        // 同步更新外部 React State 供下次使用
        setActiveChatId(currentChatId)
        if (typeof setChatId === 'function') {
          setChatId(currentChatId)
        }
      }

      // 3. 發送問答 API 請求
      const response = await fetch(`${API_BASE_URL}${currentChatId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          q: prompt,
          streaming: true,
        }),
      })

      if (!response.ok || !response.body) {
        throw new Error(`HTTP 錯誤狀態: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      let accumulatedText = '' // 區域累積變數，降低 React 重新渲染頻率

      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          let hasNewContent = false

          for (const line of lines) {
            const trimmedLine = line.trim()
            if (!trimmedLine.startsWith('data:')) continue

            const jsonStr = trimmedLine.replace(/^data:\s*/, '').trim()
            // 排除空行與 SSE 的 [DONE] 結束標記
            if (!jsonStr || jsonStr === '[DONE]') continue

            try {
              const parsed = JSON.parse(jsonStr)

              if (parsed.chunk !== undefined) {
                accumulatedText += parsed.chunk
                hasNewContent = true
              } else if (parsed.result !== undefined) {
                accumulatedText = parsed.result
                hasNewContent = true
              }
            } catch {
              // 忽略格式不完整的 JSON 片段
            }
          }

          // 每個封包 (Chunk) 讀取完畢後僅更新一次 State
          if (hasNewContent) {
            setChat((current) =>
              current.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, text: accumulatedText }
                  : msg
              )
            )
          }
        }

        // 4. 處理 Stream 結束後 buffer 中剩餘的最後一行數據
        if (buffer.trim().startsWith('data:')) {
          const jsonStr = buffer.trim().replace(/^data:\s*/, '').trim()
          if (jsonStr && jsonStr !== '[DONE]') {
            try {
              const parsed = JSON.parse(jsonStr)
              if (parsed.chunk !== undefined) {
                accumulatedText += parsed.chunk
              } else if (parsed.result !== undefined) {
                accumulatedText = parsed.result
              }

              setChat((current) =>
                current.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, text: accumulatedText }
                    : msg
                )
              )
            } catch {
              // 忽略尾端無效數據
            }
          }
        }
      } finally {
        // 確保釋放 Reader 鎖
        reader.releaseLock()
      }
    } catch (error) {
      console.error('AI 問答 API 呼叫失敗:', error)
      setChat((current) =>
        current.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                text: `⚠️ 系統連線異常，無法完成回應。（${error instanceof Error ? error.message : '請稍後再試'}）`,
              }
            : msg
        )
      )
    } finally {
      setThinking(false)
    }
  }

  

  const selectedStrategyMetrics = company.strategyMetrics.filter((metric) => strategyMetricIds.includes(metric.id))
  const strategyFinancialText = selectedStrategyMetrics.length > 0
    ? selectedStrategyMetrics.map((metric) => `${metric.label} ${metric.value}`).join('；')
    : '資料不足'
  const strategyEventText = materialEvents.events.length > 0
    ? materialEvents.events.slice(0, 5).map((event) => `- ${event.date}｜${event.title}`).join('\n')
    : '- 近 14 日無重大訊息或官方資料尚未完成同步'
  const strategyText = [
    `【${company.name}｜拜訪戰略卡】`,
    `資料產生時間：${new Date().toLocaleString('zh-TW')}`,
    `公司速覽：${company.summary}`,
    `財務體質：${strategyFinancialText}`,
    '',
    '三項數據觀察（FinMind）：',
    ...buildSignalsText(companySignals.data),
    '',
    '重大訊息觀察（公開資訊觀測站）：',
    strategyEventText,
    '',
    '建議探詢：請向企業確認營運資金規劃、短期融資配置，以及重大訊息揭露事項的實際影響。',
    '',
    '說明：本卡僅呈現外部資料與透明公式，未使用推估值或自動生成企業事實。',
  ].join('\n')

  const copyStrategy = async () => {
    await navigator.clipboard.writeText(strategyText)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const downloadStrategy = () => {
    const blob = new Blob([strategyText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${company.name}-拜訪戰略卡.txt`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const exportCompanyReport = async () => {
  const prompt = `財務指標、綜合損益表、資產負債表、現金流量表，生成${company.name}的財務報告`
  const headers = {
    'Authorization': `Bearer ${PROJECT_TOKEN}`,
    'x-application-tenant': PROJECT_ID,
    'Content-Type': 'application/json',
  }

  // 1. 使用區域變數記錄當前的 Chat ID，解決 React State 非同步落差問題
  let currentChatId = activeChatId || chatId

  // 2. 若無有效的 Chat ID，呼叫 API 建立 Session
  if (!currentChatId) {
    const createRes = await fetch(`${API_BASE_URL}create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: `Don`,
      }),
    })

    if (!createRes.ok) {
      const errText = await createRes.text()
      throw new Error(`建立 Session 失敗 (HTTP ${createRes.status}): ${errText}`)
    }

    const createData = await createRes.json()

    // 取得新 ID 並賦值給區域變數
    currentChatId =
      createData.insertedId ||
      createData.data?.insertedId ||
      createData.id ||
      createData.chatId

    if (!currentChatId) {
      throw new Error(`伺服器未回傳有效的 Chat ID，回傳內容：${JSON.stringify(createData)}`)
    }

    // 更新 React State（供後續 UI 或元件渲染使用）
    setActiveChatId(currentChatId)
    if (typeof setChatId === 'function') {
      setChatId(currentChatId)
    }
  }

  // 3. 發送請求（使用確保有值的 currentChatId）
  const response = await fetch(`${API_BASE_URL}${currentChatId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      q: prompt,
      streaming: true,
    }),
  })

  if (!response.ok || !response.body) {
    throw new Error(`HTTP 錯誤狀態: ${response.status}`)
  }

  // 4. 解析 SSE 串流，精準提取 result 或累積 chunk 內容
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let finalResult = ''
  let accumulatedChunks = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmedLine = line.trim()
        if (!trimmedLine.startsWith('data:')) continue

        const jsonStr = trimmedLine.replace(/^data:\s*/, '').trim()
        if (!jsonStr || jsonStr === '[DONE]') continue

        try {
          const parsed = JSON.parse(jsonStr)

          // 優先捕捉伺服器回傳的完整 result
          if (parsed.result !== undefined) {
            finalResult = parsed.result
          } 
          // 備用：若無 result，則累積逐字 chunk
          else if (parsed.chunk !== undefined) {
            accumulatedChunks += parsed.chunk
          }
        } catch {
          // 忽略非完整 JSON 片段
        }
      }
    }

    // 處理迴圈結束後 buffer 內殘留的最後一行
    if (buffer.trim().startsWith('data:')) {
      const jsonStr = buffer.trim().replace(/^data:\s*/, '').trim()
      if (jsonStr && jsonStr !== '[DONE]') {
        try {
          const parsed = JSON.parse(jsonStr)
          if (parsed.result !== undefined) {
            finalResult = parsed.result
          } else if (parsed.chunk !== undefined) {
            accumulatedChunks += parsed.chunk
          }
        } catch {}
      }
    }
  } finally {
    reader.releaseLock()
  }

  // 最終要輸出的 Markdown 內容（優先採用 result，若無則用 chunk 拼起來）
  const reportText = finalResult || accumulatedChunks

  if (!reportText.trim()) {
    throw new Error('伺服器未回傳有效的報告內容')
  }

  // 5. 將完整的 Markdown 文字放入 Blob 進行下載
  const blob = new Blob([reportText], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${company.name}-${company.ticker}-企業情報完整報告.md`
  
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
  setExported(true)
  window.setTimeout(() => setExported(false), 1800)
}

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="商析 Compass 首頁">
          <span className="brand-mark"><Landmark size={18} /></span>
          <span><b>商析</b><small>COMPASS</small></span>
        </a>
        <nav className={mobileNav ? 'main-nav open' : 'main-nav'}>
          <a className="active" href="#overview" onClick={() => setMobileNav(false)}>企業總覽</a>
          <a href="#financial" onClick={() => setMobileNav(false)}>財務健診</a>
          <a href="#events" onClick={() => setMobileNav(false)}>重大訊息</a>
          <a href="#conferences" onClick={() => setMobileNav(false)}>法說會</a>
          <a href="#advisor" onClick={() => setMobileNav(false)}>AI 顧問</a>
        </nav>
        <div className="header-actions">
          <span className={`data-status ${materialEvents.status}`}><i /> {materialEvents.status === 'refreshing' ? '資料同步中' : materialEvents.status === 'official' ? '官方資料已同步' : '近期資料模式'}</span>
          <button className="icon-button" aria-label="選單" onClick={() => setMobileNav((value) => !value)}>{mobileNav ? <X /> : <Menu />}</button>
          <div className="avatar">EC</div>
        </div>
      </header>

      <main id="top">
        <section className="hero" id="overview">
          <div className="hero-grain" />
          <div className="hero-inner">
            <div className="eyebrow"><Sparkles size={14} /> 企業情報決策引擎</div>
            <h1>看懂企業，<em>找到對的切入點。</em></h1>
            <p>整合財務數據、重大訊息與 AI 洞察，讓每一次拜訪都有準備、有策略。</p>
            <div className="company-search" ref={searchRef}>
              <Search size={21} />
              <input
                value={query}
                onChange={(event) => { setQuery(event.target.value); setSearchOpen(true) }}
                onFocus={() => setSearchOpen(true)}
                placeholder="輸入公司名稱、股票代碼或統一編號"
                aria-label="搜尋公司"
              />
              <kbd>⌘ K</kbd>
              {searchOpen && (
                <div className="search-results">
                  {!query && searchHistory.length > 0 && (
                    <>
                      <div className="results-label history-results-label">
                        <span>歷史查詢</span>
                        <button className="clear-search-history" onClick={() => setSearchHistory([])}>清除紀錄</button>
                      </div>
                      {searchHistory.map((item) => (
                        <button className="history-result" key={item.id} onClick={() => repeatSearch(item)}>
                          <span className="result-icon"><History size={17} /></span>
                          <span><b>{item.name}</b><small>{item.code} · {item.detail}</small></span>
                          <span className="result-market">最近查詢</span>
                        </button>
                      ))}
                      <div className="results-label suggestions-label">建議企業</div>
                    </>
                  )}
                  {query && <div className="results-label">搜尋結果 · {resultCount}</div>}
                  {!query && searchHistory.length === 0 && <div className="results-label">建議企業</div>}
                  {(query ? profileResults : companyList).slice(0, 5).map((item) => (
                    <button key={item.id} onClick={() => chooseCompany(item)}>
                      <span className="result-icon"><Building2 size={17} /></span>
                      <span><b>{item.name}</b><small>{item.ticker} · 完整企業分析</small></span>
                      <span className="result-market">{item.market}</span>
                    </button>
                  ))}
                  {query && conferenceResults.slice(0, 5).map((item) => (
                    <button key={`conference-${item.code}`} onClick={() => chooseConferenceCompany(item)}>
                      <span className="result-icon conference-result-icon"><Presentation size={17} /></span>
                      <span><b>{item.name}</b><small>{item.code} · 已匯入 {item.conferenceCount} 場法說會</small></span>
                      <span className="result-market">法說資料</span>
                    </button>
                  ))}
                  {query && resultCount === 0 && <div className="empty-result">找不到符合的公司，請試試其他關鍵字。</div>}
                </div>
              )}
            </div>
            <div className="quick-search">熱門查詢：{suggestedSearches.map((item) => <button key={item} onClick={() => { setQuery(item); setSearchOpen(true) }}>{item}</button>)}</div>
            <a className="experience-link" href="/experience/">
              <span className="experience-link-icon"><Sparkles size={15} /></span>
              <span><b>探索 Compass 情報世界</b><small>以滾動穿梭企業資料、AI 分析與行動策略</small></span>
              <ArrowRight size={16} />
            </a>
          </div>
        </section>

        <div className="content-wrap">
          <section className="company-heading reveal">
            <div className="company-monogram">{company.name.slice(0, 1)}</div>
            <div className="company-title">
              <div className="title-row"><h2>{company.name}</h2><span>{company.ticker}</span><span>{company.market}</span></div>
              <p>{company.englishName}</p>
              <div className="company-tags"><span><Building2 size={13} /> {company.industry}</span><span>統編 {company.taxId}</span><span>{company.location}</span></div>
            </div>
            <div className={`updated company-sync-status ${companySyncStatus}`}>
              <RefreshCw size={13} />
              {companySyncStatus === 'loading'
                ? `正在以「${company.name}」同步 TWSE`
                : companySyncStatus === 'official'
                  ? `TWSE 官方資料 · ${company.updatedAt}`
                  : companySyncStatus === 'fallback'
                    ? `顯示既有資料 · ${company.updatedAt}`
                    : `更新於 ${company.updatedAt}`}
            </div>
          </section>

          <section className="overview-grid reveal">
            <article className="brief-card panel">
              <div className="panel-head"><div><div className="panel-kicker">COMPANY BRIEF</div><h3>企業速覽</h3></div><FileChartColumn size={21} /></div>
              <p className="brief-summary">{company.summary}</p>
              <div className="facts">
                <div><span>成立年份</span><b>{company.founded}</b></div>
                <div><span>實收資本額</span><b>{company.capital}</b></div>
              </div>
              <a className="text-link company-website-link" href={company.website} target="_blank" rel="noreferrer">查看完整公司資料 <ExternalLink size={14} /></a>
            </article>
          </section>

          <section id="financial" className="section-block reveal">
            <div className="section-title"><div><span>FINANCIAL PULSE</span><h2>財務脈動</h2><p>TWSE 官方市場資料與核心財務指標</p></div></div>
            <TwseMarketSnapshot company={company} />
            <Suspense fallback={<div className="h-[132px] animate-pulse rounded-3xl border border-[#dcdad3] bg-[#f8f7f3]" role="status" aria-label="載入財務指標" />}>
              <AdvancedStats company={company} metrics={company.metrics} />
            </Suspense>
          </section>

          <section id="events" className="section-block reveal">
            <div className="section-title"><div><span>MATERIAL INTELLIGENCE</span><h2>重大訊息雷達</h2><p>每 4 小時同步官方重大訊息，並保留企業歷史事件脈絡</p></div><a className="text-link" href={buildMopsHistoricalNewsUrl(company.ticker)} target="_blank" rel="noreferrer">前往公開資訊觀測站 <ExternalLink size={14} /></a></div>
            <div className="event-layout">
              <div className="events panel">
                <div className="event-mode-tabs" role="tablist" aria-label="重大事件資料類型">
                  <button role="tab" aria-selected={eventMode === 'realtime'} className={eventMode === 'realtime' ? 'active' : ''} onClick={() => { setEventMode('realtime'); setEventFilter('全部') }}><CircleAlert size={15} />即時重大事件<span>{materialEvents.events.length}</span></button>
                  <button role="tab" aria-selected={eventMode === 'history'} className={eventMode === 'history' ? 'active' : ''} onClick={() => { setEventMode('history'); setEventFilter('全部') }}><History size={15} />歷史重大事件<span>{company.historicalEvents.length}</span></button>
                </div>
                <div className="event-toolbar">
                  <div className="event-filters">{eventFilters.map((filter) => <button className={eventFilter === filter ? 'active' : ''} onClick={() => setEventFilter(filter)} key={filter}>{filter}</button>)}</div>
                  {eventMode === 'realtime' && (
                    <div className={`event-sync-status ${materialEvents.status}`}>
                      <span><i />{materialEvents.status === 'refreshing' ? '同步中' : materialEvents.status === 'official' ? '官方資料已同步' : '目前顯示近期資料'}</span>
                      <small>{materialEvents.lastCheckedAt ? `上次檢查 ${materialEvents.lastCheckedAt.toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}` : '每 4 小時自動更新'}</small>
                      <button aria-label="立即更新重大訊息" title="立即更新" disabled={materialEvents.status === 'refreshing'} onClick={materialEvents.refresh}><RefreshCw size={13} /></button>
                    </div>
                  )}
                </div>
                <div className="event-list" role="tabpanel">
                  {eventMode === 'realtime' && visibleEvents.map((event) => <EventItem event={event} key={event.date + event.title} />)}
                  {eventMode === 'realtime' && visibleEvents.length === 0 && <div className="event-empty"><Check size={18} /><b>目前沒有符合條件的重大訊息</b><span>系統仍會每 4 小時自動檢查官方資料。</span></div>}
                  {eventMode === 'history' && visibleHistoricalEvents.slice(0, 8).map((event) => <HistoricalEventItem event={event} key={event.date + event.title} />)}
                  {eventMode === 'history' && visibleHistoricalEvents.length === 0 && <div className="event-empty"><History size={18} /><b>沒有符合條件的歷史事件</b><span>請切換其他事件分類。</span></div>}
                  {eventMode === 'history' && visibleHistoricalEvents.length > 8 && <button className="event-history-more" onClick={() => setHistoryOpen(true)}>另有 {visibleHistoricalEvents.length - 8} 件，開啟完整時間軸 <ArrowRight size={14} /></button>}
                </div>
              </div>
              <aside className="radar-aside">
                {eventMode === 'realtime' ? (
                  <div className="attention-card"><div><CircleAlert size={19} /> 即時與近期關注</div><strong>{materialEvents.events.length}</strong><span>則重大訊息</span><p>正向動態 {materialEvents.events.filter((e) => e.impact === '正向').length} 則，需留意 {materialEvents.events.filter((e) => e.impact === '留意').length} 則</p></div>
                ) : (
                  <div className="attention-card history-attention"><div><History size={19} /> 歷史事件資料庫</div><strong>{company.historicalEvents.length}</strong><span>件重大事件</span><p>涵蓋 {company.historicalEvents.at(-1)?.date.slice(0, 4)} 至 {company.historicalEvents[0]?.date.slice(0, 4)} 年企業發展脈絡</p></div>
                )}
                <button className="history-card" onClick={() => setHistoryOpen(true)}><History size={19} /><div><b>開啟完整歷史時間軸</b><span>追溯企業近 20 年重大動態</span></div><ArrowRight size={17} /></button>
              </aside>
            </div>
          </section>

          <ConferenceCenter />

          {/* AI 顧問區塊 */}
          <section id="advisor" className="advisor-section reveal">
            <div className="advisor-intro">
              <div className="eyebrow dark"><Bot size={14} /> AI 企業顧問</div>
              <h2>有什麼想進一步了解？</h2>
              <p>根據財報、重大訊息與產業資料，快速釐清機會與風險。</p>
              <div className="suggestion-list">
                {company.questions.map((item) => (
                  <button key={item} onClick={() => ask(item)}>
                    <MessageSquareText size={15} />{item}<ArrowRight size={14} />
                  </button>
                ))}
              </div>
            </div>
            
            <div className="chat-card">
              <div className="chat-top">
                <div>
                  <span className="ai-orb"><Sparkles size={16} /></span>
                  <div><b>商析 AI</b><small><i /> 已連結企業資料庫</small></div>
                </div>
              </div>
              
              <div className="chat-body">
                {chat.length === 0 ? (
                  <div className="chat-empty">
                    <Bot size={27} />
                    <p>可以問我財務表現、風險或拜訪切入點。</p>
                  </div>
                ) : (
                  chat.map((message, index) => (
                    <div key={message.id || index} className={`message ${message.role}`}>
                      {message.role === 'assistant' ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.text}
                        </ReactMarkdown>
                      ) : (
                        message.text
                      )}
                    </div>
                  ))
                )}
                {thinking && <div className="typing"><i /><i /><i /></div>}
              </div>
              
              <div className="chat-input">
                <textarea
                  rows={2}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      ask()
                    }
                  }}
                  placeholder={`詢問關於 金融 的問題...`}
                />
                <button
                  disabled={!question.trim() || thinking}
                  onClick={() => ask()}
                  aria-label="送出"
                >
                  <Send size={18} />
                </button>
                <span>Enter 送出 · Shift + Enter 換行</span>
              </div>
            </div>
          </section>

          <section className="strategy-banner reveal">
            <div className="strategy-icon"><Target size={25} /></div>
            <div><span>VISIT STRATEGY</span><h2>準備好下一次關鍵拜訪</h2><p>一鍵整合企業概況、財務重點與商機，產生專屬拜訪戰略卡。</p></div>
            <button onClick={() => setStrategyOpen(true)}><Sparkles size={17} /> 產生拜訪戰略卡 <ArrowRight size={16} /></button>
          </section>

          <section className="export-banner reveal" aria-labelledby="export-company-title">
            <div className="export-icon"><FileText size={24} /></div>
            <div><span>COMPLETE COMPANY REPORT</span><h2 id="export-company-title">匯出 {company.name} 完整企業內容</h2><p>包含公司概況、財務指標、重大事件、歷史事件、風險、商機與建議提問。</p></div>
            <button onClick={exportCompanyReport}>{exported ? <Check size={17} /> : <Download size={17} />}{exported ? '已匯出完整報告' : '匯出完整企業報告'}</button>
          </section>
        </div>
      </main>

      <footer><div className="brand footer-brand"><span className="brand-mark"><Landmark size={16} /></span><span><b>商析</b><small>COMPASS</small></span></div><p>資料僅供參考，不構成任何投資或授信建議。</p><span>© 2026 Financial Intelligence Lab</span></footer>

      {strategyOpen && <StrategyModal company={company} metricIds={strategyMetricIds} setMetricIds={setStrategyMetricIds} signals={companySignals} materialEvents={materialEvents.events} close={() => setStrategyOpen(false)} copy={copyStrategy} download={downloadStrategy} copied={copied} />}
      {historyOpen && <HistoryModal company={company} close={() => setHistoryOpen(false)} />}
    </div>
  )
}

function ConferenceCenter() {
  const [group, setGroup] = useState('PCB')
  const [companyCode, setCompanyCode] = useState('全部')
  const [showAll, setShowAll] = useState(false)
  const [conferenceQuery, setConferenceQuery] = useState<ConferenceQueryState>({
    status: 'idle',
    message: '顯示既有匯入資料',
    items: conferences,
  })
  const groupCompanies = conferenceCompanies.filter((company: { group?: string }) => company.group === group)
  const activeCompany = initialCompanies.find((company) => company.ticker === companyCode)
  const importYear = new Date().getFullYear() - 1911
  const importMonth = String(new Date().getMonth() + 1).padStart(2, '0')
  const selectedMarket = activeCompany?.market ?? '上市'
  const sourceYear = String(importYear)
  const sourceMonth = importMonth
  const queryCode = companyCode === '全部' ? '' : companyCode
  const filtered = conferenceQuery.items.filter((conference) => {
    if (companyCode !== '全部') return conference.companyCode === companyCode
    return groupCompanies.some((company: { code: string }) => company.code === conference.companyCode)
  })
  const visible = showAll ? filtered : filtered.slice(0, 8)
  const latestDate = filtered[0]?.date ?? '尚無資料'
  const selectedTypeK = selectedMarket === '上櫃'
    ? 'otc'
    : selectedMarket === '興櫃'
      ? 'rotc'
      : selectedMarket === '公開發行'
        ? 'pub'
        : 'sii'
  const officialSourceHref = companyCode === '全部'
    ? conferenceData.source.url
    : 'https://mopsov.twse.com.tw/mops/web/ajax_t100sb02_1'

  const openOfficialSource = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (companyCode === '全部') return
    event.preventDefault()

    const now = new Date()
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = officialSourceHref
    form.target = '_blank'

    const fields = {
      subMenuID: '2',
      step: '1',
      firstin: '1',
      off: '1',
      TYPEK: selectedTypeK,
      year: String(now.getFullYear() - 1911),
      month: String(now.getMonth() + 1).padStart(2, '0'),
      co_id: companyCode,
    }

    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = value
      form.appendChild(input)
    }

    document.body.appendChild(form)
    form.submit()
    form.remove()
  }

  useEffect(() => {
    const controller = new AbortController()

    const importConferenceData = async () => {
      if (!queryCode) {
        setConferenceQuery({ status: 'idle', message: '顯示既有匯入資料', items: conferences })
        return
      }

      setConferenceQuery((current) => ({ ...current, status: 'loading', message: `正在匯入 ${queryCode} 的法說會資料` }))

      try {
        const params = new URLSearchParams({
          ticker: queryCode,
          market: selectedMarket,
          year: sourceYear,
          month: sourceMonth,
        })
        const response = await fetch(`/api/twse-conferences?${params}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(`法說會資料同步失敗：${response.status}`)
        }

        const payload = await response.json() as { conferences?: ConferenceItem[]; message?: string }
        const items = Array.isArray(payload.conferences) ? payload.conferences : []
        setConferenceQuery({
          status: 'ready',
          message: items.length > 0
            ? `已匯入 ${items.length} 筆 ${queryCode} 的法說會資料`
            : `${queryCode} 在目前條件下查無法說會資料`,
          items,
        })
      } catch (error) {
        if (controller.signal.aborted) return
        setConferenceQuery({
          status: 'error',
          message: error instanceof Error ? error.message : '法說會資料匯入失敗',
          items: conferences,
        })
      }
    }

    void importConferenceData()
    return () => controller.abort()
  }, [queryCode, selectedMarket, sourceYear, sourceMonth])

  useEffect(() => {
    const selectCompany = (event: Event) => {
      const { code, group: nextGroup } = (event as CustomEvent<{ code: string; group: string }>).detail
      setGroup(nextGroup)
      setCompanyCode(code)
      setShowAll(false)
    }
    window.addEventListener('select-conference-company', selectCompany)
    return () => window.removeEventListener('select-conference-company', selectCompany)
  }, [])

  const changeGroup = (next: string) => {
    setGroup(next)
    setCompanyCode('全部')
    setShowAll(false)
  }

  return <section id="conferences" className="section-block conference-section reveal">
    <div className="section-title">
      <div><span>INVESTOR CONFERENCE</span><h2>法說會情報庫</h2><p>公開資訊觀測站 2024 至 2026 年逐場資料與原始簡報</p></div>
      <a className="text-link" href={officialSourceHref} target="_blank" rel="noreferrer" onClick={openOfficialSource}>官方資料來源 <ExternalLink size={14} /></a>
    </div>
    <div className="conference-summary">
    <div><Presentation size={19} /><span>已匯入</span><strong>{conferences.length}</strong><small>場法說會</small></div>
    <div><Building2 size={19} /><span>追蹤企業</span><strong>{conferenceCompanies.length}</strong><small>家公司</small></div>
      <div><CalendarDays size={19} /><span>最新場次</span><strong>{latestDate}</strong><small>依目前篩選</small></div>
      <div><RefreshCw size={19} /><span>資料更新</span><strong>{new Date(conferenceData.generatedAt).toLocaleDateString('zh-TW')}</strong><small>可重新執行匯入</small></div>
    </div>
    <div className="conference-toolbar panel">
      <div className="conference-groups">
        {['PCB', '資訊服務業'].map((item) => <button key={item} className={group === item ? 'active' : ''} onClick={() => changeGroup(item)}>{item}<span>{conferenceCompanies.filter((company: { group?: string }) => company.group === item).length}</span></button>)}
      </div>
      <label>企業篩選<select value={companyCode} onChange={(event) => { setCompanyCode(event.target.value); setShowAll(false) }}><option value="全部">全部企業</option>{groupCompanies.map((item: { code: string; name: string; conferenceCount: number }) => <option value={item.code} key={item.code}>{item.code} {item.name}（{item.conferenceCount}）</option>)}</select></label>
    </div>
    <div className="tracked-companies">
      {groupCompanies.map((item: { code: string; name: string; conferenceCount: number; note?: string }) => <button key={item.code} title={item.note} className={companyCode === item.code ? 'active' : ''} onClick={() => { setCompanyCode(companyCode === item.code ? '全部' : item.code); setShowAll(false) }}><b>{item.code}</b>{item.name}<span>{item.conferenceCount}</span>{item.note && <i>!</i>}</button>)}
    </div>
    <div className="conference-list panel">
      <div className="conference-list-head"><span>共 {filtered.length} 場資料</span><small>{conferenceQuery.status === 'loading' ? '匯入中' : '最新日期優先'}</small></div>
      {visible.map((item: ConferenceItem) => {
        const [startDate, endDate] = item.date.split(' 至 ')
        return <article className="conference-item" key={`${item.companyCode}-${item.date}-${item.time}-${item.summary}`}>
        <div className="conference-date"><strong>{startDate.slice(5).replace('-', '.')}</strong><span>{endDate ? `至 ${endDate.slice(5).replace('-', '.')}` : `${startDate.slice(0, 4)} · ${item.time || '時間未定'}`}</span></div>
        <div className="conference-company"><span>{item.market}</span><b>{item.companyCode}</b><strong>{item.companyName}</strong></div>
        <div className="conference-detail"><h3>{item.summary || '法人說明會'}</h3><p><MapPin size={12} />{item.location || '地點未公告'}</p></div>
        <div className="conference-links">
          {item.presentationZh && <a href={item.presentationZh} target="_blank" rel="noreferrer" title="中文簡報"><FileText size={15} />簡報</a>}
          {item.videos[0] && <a href={item.videos[0]} target="_blank" rel="noreferrer" title="法說影音"><Video size={15} />影音</a>}
          {item.website && <a href={item.website} target="_blank" rel="noreferrer" title="公司投資人網站"><ExternalLink size={15} /></a>}
        </div>
      </article>})}
      {visible.length === 0 && <div className="conference-empty">此企業在匯入期間沒有法說會資料。</div>}
    </div>
    {filtered.length > 8 && <button className="load-more" onClick={() => setShowAll((value) => !value)}>{showAll ? '收合資料' : `顯示全部 ${filtered.length} 場`} <ChevronDown size={15} className={showAll ? 'rotate' : ''} /></button>}
    <p className="source-note">資料來源：{conferenceData.source.name}。{conferenceQuery.message}。公司分類依提供清單保留，驚嘆號代表與官方產業分類不同或名稱經校正。</p>
  </section>
}

function EventItem({ event }: { event: MaterialEvent }) {
  return <article className="event-item"><div className="event-date"><Clock3 size={13} />{event.date}</div><div className={`event-category cat-${event.category}`}>{event.category}</div><div className="event-content"><h3>{event.title}</h3><p>{event.summary}</p></div><span className={`impact impact-${event.impact}`}>{event.impact}</span></article>
}

function HistoricalEventItem({ event }: { event: HistoricalEvent }) {
  return <article className="event-item historical-event-item"><div className="event-date"><History size={13} />{event.date}</div><div className={`event-category history-${event.category}`}>{event.category}</div><div className="event-content"><h3>{event.title}</h3><p>{event.summary}</p></div><span className="history-record-label">歷史</span></article>
}

function HistoryModal({ company, close }: { company: Company; close: () => void }) {
  const [category, setCategory] = useState('全部')
  const categories = ['全部', '技術投資', '營運發展', '公司治理', '市場合作']
  const events = category === '全部' ? company.historicalEvents : company.historicalEvents.filter((event) => event.category === category)
  const oldestYear = company.historicalEvents.at(-1)?.date.slice(0, 4)
  const latestYear = company.historicalEvents[0]?.date.slice(0, 4)

  return <div className="modal-backdrop history-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) close() }}>
    <div className="history-modal" role="dialog" aria-modal="true" aria-label={`${company.name}歷史事件資料庫`}>
      <header className="history-modal-head">
        <div><span>20-YEAR CORPORATE TIMELINE</span><h2>{company.name}</h2><p>{oldestYear}－{latestYear} 重大事件與策略里程碑</p></div>
        <div className="history-count"><strong>{company.historicalEvents.length}</strong><span>件重大事件</span></div>
        <button onClick={close} aria-label="關閉"><X size={20} /></button>
      </header>
      <div className="history-filter">{categories.map((item) => <button className={category === item ? 'active' : ''} key={item} onClick={() => setCategory(item)}>{item}<span>{item === '全部' ? company.historicalEvents.length : company.historicalEvents.filter((event) => event.category === item).length}</span></button>)}</div>
      <div className="history-timeline">
        {events.map((event, index) => <article key={`${event.date}-${event.title}`}>
          <div className="timeline-date"><strong>{event.date.slice(0, 4)}</strong><span>{event.date.slice(5)}</span></div>
          <div className="timeline-marker"><i />{index < events.length - 1 && <span />}</div>
          <div className="timeline-content"><span className={`history-category history-${event.category}`}>{event.category}</span><h3>{event.title}</h3><p>{event.summary}</p></div>
        </article>)}
      </div>
      <div className="history-modal-footer"><p><CircleAlert size={13} />本時間軸整理自公司公開資訊與重大訊息，供拜訪準備使用。</p><div><a href={company.website} target="_blank" rel="noreferrer">公司官方網站 <ExternalLink size={12} /></a><a href="https://mops.twse.com.tw/mops/" target="_blank" rel="noreferrer">公開資訊觀測站 <ExternalLink size={12} /></a></div></div>
    </div>
  </div>
}

function StrategyModal({ company, metricIds, setMetricIds, signals, materialEvents, close, copy, download, copied }: { company: Company; metricIds: string[]; setMetricIds: React.Dispatch<React.SetStateAction<string[]>>; signals: CompanySignalsState; materialEvents: MaterialEvent[]; close: () => void; copy: () => void; download: () => void; copied: boolean }) {
  const toggleMetric = (id: string) => {
    setMetricIds((current) => current.includes(id) ? current.filter((metricId) => metricId !== id) : current.length < 5 ? [...current, id] : current)
  }

  const revenueTrend = signals.data?.revenueTrend ?? null
  const liquidity = signals.data?.liquidity ?? null
  const fiveDayInstitutional = signals.data?.institutionalTrend?.windows.find((item) => item.requestedDays === 5) ?? null
  const twentyDayInstitutional = signals.data?.institutionalTrend?.windows.find((item) => item.requestedDays === 20) ?? null
  const signalSourceUrl = signals.data?.source.url ?? 'https://finmindtrade.com/'
  const officialNewsUrl = buildMopsHistoricalNewsUrl(company.ticker)

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) close() }}>
    <div className="strategy-modal" role="dialog" aria-modal="true" aria-label="拜訪戰略卡">
      <div className="modal-head"><div><span>VISIT BRIEF · {new Date().toLocaleDateString('zh-TW')}</span><h2>{company.name}</h2><p>關鍵客戶拜訪戰略卡</p></div><button onClick={close}><X size={20} /></button></div>
      {company.summary && company.summary !== '無公司簡介資料' && (
        <div className="strategy-summary">
          <span>COMPANY BRIEF</span>
          <p>{company.summary}</p>
        </div>
      )}
      {company.strategyMetrics.length > 0 && <section className="strategy-metrics-section">
          <div className="strategy-metrics-head"><div><span>FINANCIAL SNAPSHOT</span><h3>財務體質快照</h3></div><small>選擇顯示指標 · 最多 5 項</small></div>
          <div className="metric-selector">
            {company.strategyMetrics.map((metric) => {
              const selected = metricIds.includes(metric.id)
              return <button key={metric.id} className={selected ? 'selected' : ''} disabled={!selected && metricIds.length >= 5} onClick={() => toggleMetric(metric.id)}><span>{selected && <Check size={11} />}</span>{metric.label}</button>
            })}
          </div>
          <div className="strategy-metric-grid">
            {company.strategyMetrics.filter((metric) => metricIds.includes(metric.id)).map((metric) => <article key={metric.id}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.note}</small></article>)}
            {metricIds.length === 0 && <p className="no-metrics">請至少選擇一項財務指標。</p>}
          </div>
        </section>}

      <div className="strategy-evidence-grid">
        <section className="strategy-evidence-panel" aria-labelledby="data-observations-title">
          <div className="evidence-panel-head">
            <div><span>VERIFIED DATA SIGNALS</span><h3 id="data-observations-title"><TrendingUp size={16} /> 三項數據觀察</h3></div>
            <a href={signalSourceUrl} target="_blank" rel="noreferrer">FinMind <ExternalLink size={10} /></a>
          </div>
          <p className={`signal-sync-state ${signals.status}`}>{signals.status === 'loading' && <RefreshCw size={11} />}{signals.message}</p>
          <div className="signal-card-list">
            <article className="signal-card">
              <header><b>01</b><div><strong>近三年營收</strong><small>完整年度月營收加總</small></div></header>
              {revenueTrend ? <>
                <div className="revenue-year-grid">
                  {revenueTrend.years.map((item) => <div key={item.year}><span>{item.year}</span><strong>{formatFinancialAmount(item.revenue)}</strong><small>{item.yoy === null ? '基準年度' : `年增 ${item.yoy > 0 ? '+' : ''}${item.yoy.toLocaleString('zh-TW', { maximumFractionDigits: 1 })}%`}</small></div>)}
                </div>
                <p>{revenueTrend.consecutiveGrowth === null ? '完整年度不足三年，暫不判定連續趨勢。' : `連續兩年營收成長：${revenueTrend.consecutiveGrowth ? '是' : '否'}`}</p>
              </> : <p className="signal-empty">FinMind 尚無三個完整年度的月營收資料。</p>}
            </article>

            <article className="signal-card">
              <header><b>02</b><div><strong>週轉與短期融資</strong><small>{liquidity ? `${liquidity.reportDate} 財報` : '最新可用財報'}</small></div></header>
              {liquidity ? <div className="liquidity-signal-grid">
                <div><span>營運資金</span><strong>{formatFinancialAmount(liquidity.workingCapital)}</strong><small>流動資產－流動負債</small></div>
                <div><span>流動比率</span><strong>{formatSignalPercent(liquidity.currentRatio)}</strong><small>流動資產／流動負債</small></div>
                <div><span>短期融資占比</span><strong>{formatSignalPercent(liquidity.shortTermFinancingRatio)}</strong><small>短期融資／流動負債</small></div>
                <div><span>現金流量比率</span><strong>{formatSignalPercent(liquidity.cashFlowRatio)}</strong><small>營業現金流／流動負債</small></div>
              </div> : <p className="signal-empty">FinMind 尚無計算四項公式所需的完整財報欄位。</p>}
            </article>

            <article className="signal-card">
              <header><b>03</b><div><strong>三大法人買賣趨勢</strong><small>{signals.data?.institutionalTrend?.asOf ? `截至 ${signals.data.institutionalTrend.asOf}` : '逐日實際買賣超'}</small></div></header>
              {twentyDayInstitutional ? <>
                <div className="institution-summary"><span>近 {twentyDayInstitutional.actualDays} 個交易日合計</span><strong className={twentyDayInstitutional.total >= 0 ? 'positive' : 'negative'}>{formatNetLots(twentyDayInstitutional.total)}</strong></div>
                <div className="institution-breakdown"><span>外資 {formatNetLots(twentyDayInstitutional.foreign)}</span><span>投信 {formatNetLots(twentyDayInstitutional.investmentTrust)}</span><span>自營商 {formatNetLots(twentyDayInstitutional.dealer)}</span>{fiveDayInstitutional && <span>近 {fiveDayInstitutional.actualDays} 日 {formatNetLots(fiveDayInstitutional.total)}</span>}</div>
              </> : <p className="signal-empty">FinMind 尚無最近交易日的三大法人買賣資料。</p>}
            </article>
          </div>
          <p className="verified-data-note"><Check size={11} /> 僅呈現來源數據與透明公式，不使用推估值。</p>
        </section>

        <section className="material-observation-panel" aria-labelledby="material-observation-title">
          <div className="evidence-panel-head"><div><span>OFFICIAL DISCLOSURES</span><h3 id="material-observation-title"><CircleAlert size={16} /> 重大訊息觀察</h3></div></div>
          <p className="material-observation-intro">直接引用公開資訊觀測站公告，不進行正負面推測。</p>
          <div className="material-observation-list">
            {materialEvents.slice(0, 4).map((event) => <article key={`${event.date}-${event.title}`}><time>{event.date}</time><h4>{event.title}</h4></article>)}
            {materialEvents.length === 0 && <p className="signal-empty">近 14 日無重大訊息，或官方資料仍在同步。</p>}
          </div>
          <a className="official-news-link" href={officialNewsUrl} target="_blank" rel="noreferrer">查看官方重大訊息 <ExternalLink size={11} /></a>
        </section>
      </div>
      <section className="opening-script"><span>RECOMMENDED OPENING</span><h3>建議開場與探詢</h3><p>「想就貴公司近三年營運表現、週轉資金配置與近期重大訊息進一步了解，請問目前資金規劃上最需要金融機構協助的項目為何？」</p></section>
      {company.questions.length > 0 && <div className="question-chips">{company.questions.map((item) => <span key={item}><Check size={13} />{item}</span>)}</div>}
      <div className="modal-actions"><button className="secondary" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? '已複製' : '複製內容'}</button><button className="primary" onClick={download}><Download size={16} /> 下載戰略卡</button></div>
    </div>
  </div>
}

export default App
