import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { fetchTwseRecentEventsFromHistory } from './lib/twse-historical-events'

const nativeFetch = window.fetch.bind(window)

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
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined)

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
