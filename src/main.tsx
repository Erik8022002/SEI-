import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import conferenceData from './generated/investor-conferences.json'
import { fetchTwseRecentEventsFromHistory } from './lib/twse-historical-events'

type StaticConference = Record<string, unknown>
type StaticConferenceDataset = {
  generatedAt?: string
  source?: {
    name?: string
    years?: number[]
  }
  conferences?: StaticConference[]
}

const staticConferenceDataset = conferenceData as unknown as StaticConferenceDataset
const staticConferences = Array.isArray(staticConferenceDataset.conferences)
  ? staticConferenceDataset.conferences
  : []
const nativeFetch = window.fetch.bind(window)

function conferenceCompanyCode(item: StaticConference) {
  return String(item.companyCode ?? item['公司代號'] ?? item.code ?? '').trim()
}

function requestSignal(input: RequestInfo | URL, init?: RequestInit) {
  return init?.signal ?? (input instanceof Request ? input.signal : undefined)
}

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const rawUrl = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url
  const url = new URL(rawUrl, window.location.origin)

  if (url.origin === window.location.origin && url.pathname === '/api/material-events') {
    const ticker = url.searchParams.get('ticker') ?? ''
    const market = url.searchParams.get('market') ?? ''
    const signal = requestSignal(input, init)

    try {
      const payload = await fetchTwseRecentEventsFromHistory(ticker, market, signal)
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      })
    } catch (error) {
      if (signal?.aborted) throw error
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : '近期重大事件同步失敗',
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      })
    }
  }

  if (url.origin === window.location.origin && url.pathname === '/api/twse-conferences') {
    const ticker = url.searchParams.get('ticker')?.trim() ?? ''
    const market = url.searchParams.get('market')?.trim() ?? ''
    const signal = requestSignal(input, init)

    if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError')

    const conferences = staticConferences
      .filter((item) => conferenceCompanyCode(item) === ticker)
      .sort((a, b) => {
        const aKey = `${String(a.date ?? '')} ${String(a.time ?? '')}`
        const bKey = `${String(b.date ?? '')} ${String(b.time ?? '')}`
        return bKey.localeCompare(aKey)
      })

    const years = Array.isArray(staticConferenceDataset.source?.years)
      ? staticConferenceDataset.source.years
      : [new Date().getFullYear() - 2, new Date().getFullYear() - 1, new Date().getFullYear()]

    return new Response(JSON.stringify({
      ticker,
      market,
      years,
      rangeLabel: years.length > 0 ? `${Math.min(...years)}–${Math.max(...years)}` : '',
      fetchedAt: staticConferenceDataset.generatedAt ?? new Date().toISOString(),
      source: staticConferenceDataset.source?.name ?? '公開資訊觀測站－法人說明會一覽表',
      conferences,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  }

  return nativeFetch(input, init)
}

const isExperienceAlias = /^\/experience\/?$/.test(window.location.pathname)

if (isExperienceAlias) {
  window.location.replace(`/experience/index.html${window.location.search}${window.location.hash}`)
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
