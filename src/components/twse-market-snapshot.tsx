import { useEffect, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Database, ExternalLink, RefreshCw } from 'lucide-react'

import type { Company } from '@/data'
import { fetchTwseMarketSnapshot, type TwseMarketSnapshotData } from '@/lib/twse-market'

type SyncStatus = 'loading' | 'official' | 'unavailable' | 'error'

function formatValue(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString('zh-TW', { maximumFractionDigits: digits })
}

function formatVolume(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'
  return `${Math.round(value / 1000).toLocaleString('zh-TW')} 張`
}

export function TwseMarketSnapshot({ company }: { company: Company }) {
  const [status, setStatus] = useState<SyncStatus>('loading')
  const [snapshot, setSnapshot] = useState<TwseMarketSnapshotData | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setSnapshot(null)

    void fetchTwseMarketSnapshot(company, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return
        setSnapshot(data)
        setStatus(data.available ? 'official' : 'unavailable')
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error')
      })

    return () => controller.abort()
  }, [company, refreshToken])

  const change = snapshot?.market?.change
  const changeIsPositive = change !== null && change !== undefined && change >= 0

  return (
    <section className={`twse-market-panel panel ${status}`} aria-label="TWSE 上市市場資料" aria-live="polite">
      <header className="twse-market-head">
        <div className="twse-market-title">
          <span className="twse-market-icon"><Database size={16} /></span>
          <div><span>TWSE OPENAPI</span><h3>證交所每日市場資料</h3></div>
        </div>
        <div className="twse-market-actions">
          <span className="twse-source-status"><i />{status === 'loading' ? '同步中' : status === 'official' ? '官方資料已同步' : status === 'unavailable' ? '此公司無 TWSE 資料' : '暫時無法同步'}</span>
          <button type="button" onClick={() => setRefreshToken((value) => value + 1)} disabled={status === 'loading'} aria-label="重新同步 TWSE 市場資料" title="重新同步">
            <RefreshCw size={13} />
          </button>
        </div>
      </header>

      {status === 'loading' && (
        <div className="twse-market-loading" role="status">
          {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
        </div>
      )}

      {status === 'official' && snapshot?.market && snapshot.valuation && (
        <div className="twse-market-grid">
          <article>
            <span>收盤價</span>
            <strong>{formatValue(snapshot.market.close)} <small>元</small></strong>
            <small>高 {formatValue(snapshot.market.high)} · 低 {formatValue(snapshot.market.low)}</small>
          </article>
          <article>
            <span>當日漲跌</span>
            <strong className={changeIsPositive ? 'market-up' : 'market-down'}>
              {changeIsPositive ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />}
              {changeIsPositive ? '+' : ''}{formatValue(change)}
            </strong>
            <small className={changeIsPositive ? 'market-up' : 'market-down'}>{changeIsPositive ? '+' : ''}{formatValue(snapshot.market.changePercent)}%</small>
          </article>
          <article><span>成交量</span><strong>{formatVolume(snapshot.market.tradeVolume)}</strong><small>{formatValue(snapshot.market.transactions, 0)} 筆成交</small></article>
          <article><span>本益比</span><strong>{formatValue(snapshot.valuation.peRatio)} <small>倍</small></strong><small>Price / Earnings</small></article>
          <article><span>殖利率</span><strong>{formatValue(snapshot.valuation.dividendYield)} <small>%</small></strong><small>Dividend yield</small></article>
          <article><span>股價淨值比</span><strong>{formatValue(snapshot.valuation.pbRatio)} <small>倍</small></strong><small>Price / Book</small></article>
        </div>
      )}

      {(status === 'unavailable' || status === 'error') && (
        <div className="twse-market-empty">
          <Database size={18} />
          <div><b>{status === 'unavailable' ? snapshot?.reason : 'TWSE 官方服務暫時無法連線'}</b><span>現有企業財務分析仍可正常使用。</span></div>
        </div>
      )}

      <footer className="twse-market-foot">
        <span>{snapshot?.date ? `資料日期 ${snapshot.date}` : '每日收盤後更新'}</span>
        <a href="https://openapi.twse.com.tw/" target="_blank" rel="noreferrer">臺灣證券交易所 OpenAPI <ExternalLink size={11} /></a>
      </footer>
    </section>
  )
}
