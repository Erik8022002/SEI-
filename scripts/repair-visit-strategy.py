from pathlib import Path
import re

path = Path('src/App.tsx')
text = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, got {count}')
    text = text.replace(old, new, 1)


replace_once(
    "import { fetchTwseHistoricalEvents, mergeTwseHistoricalEvents } from './lib/twse-historical-events'\n",
    "import { fetchTwseHistoricalEvents, mergeTwseHistoricalEvents } from './lib/twse-historical-events'\nimport { generateVisitStrategyCard, visitStrategyToText, type VisitStrategyCard } from './lib/visit-strategy'\n",
    'visit strategy import',
)

replace_once(
    "  const [strategyOpen, setStrategyOpen] = useState(false)\n",
    "  const [strategyOpen, setStrategyOpen] = useState(false)\n"
    "  const [strategyStatus, setStrategyStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')\n"
    "  const [strategyCard, setStrategyCard] = useState<VisitStrategyCard | null>(null)\n"
    "  const [strategyError, setStrategyError] = useState('')\n"
    "  const [strategyChatId, setStrategyChatId] = useState<string | null>(null)\n",
    'strategy state',
)

replace_once(
    "  const [strategyMetricIds, setStrategyMetricIds] = useState(['revenue', 'grossMargin', 'debtRatio', 'currentRatio', 'eps'])\n",
    "  const [strategyMetricIds, setStrategyMetricIds] = useState<string[]>([])\n",
    'initial metric selection',
)

replace_once(
    "    setChat([])\n    setEventMode('realtime')\n",
    "    setChat([])\n"
    "    setStrategyOpen(false)\n"
    "    setStrategyStatus('idle')\n"
    "    setStrategyCard(null)\n"
    "    setStrategyError('')\n"
    "    setStrategyChatId(null)\n"
    "    setEventMode('realtime')\n",
    'company strategy reset',
)

replace_once(
    "    setStrategyMetricIds(['revenue', 'grossMargin', 'debtRatio', 'currentRatio', 'eps'])\n",
    "    setStrategyMetricIds([])\n",
    'company metric reset',
)

text, dead_count = re.subn(
    r"\n  const exportReport = async \(\) => \{\s*\}\n",
    "\n",
    text,
    count=1,
)
if dead_count != 1:
    raise SystemExit(f'dead exportReport: expected 1 match, got {dead_count}')

placeholder_count = text.count("title: `Don`,")
if placeholder_count != 2:
    raise SystemExit(f'test session title: expected 2 matches, got {placeholder_count}')
text = text.replace("title: `Don`,", "title: `${company.name} AI 工作階段`,")

strategy_block_pattern = re.compile(
    r"  const selectedStrategyMetrics = company\.strategyMetrics\.filter\(\(metric\) => strategyMetricIds\.includes\(metric\.id\)\)[\s\S]*?\n  const exportCompanyReport = async \(\) => \{",
)
strategy_block = '''  const selectedStrategyMetrics = company.strategyMetrics.filter((metric) => strategyMetricIds.includes(metric.id))

  const generateStrategy = async () => {
    if (strategyStatus === 'loading') return

    setStrategyOpen(true)
    setStrategyStatus('loading')
    setStrategyError('')
    setStrategyCard(null)

    try {
      const conferenceSummaries = conferences
        .filter((item) => item.companyCode === company.ticker)
        .slice(0, 6)
        .map((item) => `${item.date} ${item.time}｜${item.summary || '法人說明會'}｜${item.location || '地點未公告'}`)

      const result = await generateVisitStrategyCard({
        apiBaseUrl: API_BASE_URL,
        projectId: PROJECT_ID,
        projectToken: PROJECT_TOKEN,
        sessionId: strategyChatId,
        company,
        currentEvents: materialEvents.events,
        conferenceSummaries,
      })

      setStrategyChatId(result.sessionId)
      setStrategyCard(result.card)
      setStrategyStatus('ready')
    } catch (error) {
      console.error('拜訪戰略卡生成失敗:', error)
      setStrategyError(error instanceof Error ? error.message : '無法產生拜訪戰略卡，請稍後再試')
      setStrategyStatus('error')
    }
  }

  const strategyText = strategyCard
    ? visitStrategyToText(company, strategyCard, selectedStrategyMetrics)
    : ''

  const copyStrategy = async () => {
    if (!strategyText) return
    await navigator.clipboard.writeText(strategyText)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const downloadStrategy = () => {
    if (!strategyText) return
    const blob = new Blob([strategyText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${company.name}-拜訪戰略卡.txt`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const exportCompanyReport = async () => {'''
text, strategy_count = strategy_block_pattern.subn(strategy_block, text, count=1)
if strategy_count != 1:
    raise SystemExit(f'strategy generation block: expected 1 match, got {strategy_count}')

replace_once(
    "            <button onClick={() => setStrategyOpen(true)}><Sparkles size={17} /> 產生拜訪戰略卡 <ArrowRight size={16} /></button>\n",
    "            <button disabled={strategyStatus === 'loading'} onClick={() => void generateStrategy()}>{strategyStatus === 'loading' ? <RefreshCw size={17} /> : <Sparkles size={17} />} {strategyStatus === 'loading' ? '正在產生戰略卡' : strategyStatus === 'ready' ? '重新產生拜訪戰略卡' : '產生拜訪戰略卡'} <ArrowRight size={16} /></button>\n",
    'strategy banner button',
)

replace_once(
    "      {strategyOpen && <StrategyModal company={company} metricIds={strategyMetricIds} setMetricIds={setStrategyMetricIds} close={() => setStrategyOpen(false)} copy={copyStrategy} download={downloadStrategy} copied={copied} />}\n",
    "      {strategyOpen && <StrategyModal company={company} metricIds={strategyMetricIds} setMetricIds={setStrategyMetricIds} close={() => setStrategyOpen(false)} copy={copyStrategy} download={downloadStrategy} copied={copied} strategy={strategyCard} status={strategyStatus} error={strategyError} retry={() => void generateStrategy()} />}\n",
    'strategy modal invocation',
)

modal_pattern = re.compile(r"function StrategyModal\([\s\S]*?\n\}\n\nexport default App")
new_modal = '''type StrategyModalProps = {
  company: Company
  metricIds: string[]
  setMetricIds: React.Dispatch<React.SetStateAction<string[]>>
  close: () => void
  copy: () => void
  download: () => void
  copied: boolean
  strategy: VisitStrategyCard | null
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string
  retry: () => void
}

function StrategyModal({ company, metricIds, setMetricIds, close, copy, download, copied, strategy, status, error, retry }: StrategyModalProps) {
  const toggleMetric = (id: string) => {
    setMetricIds((current) => current.includes(id) ? current.filter((metricId) => metricId !== id) : current.length < 5 ? [...current, id] : current)
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) close() }}>
    <div className="strategy-modal" role="dialog" aria-modal="true" aria-label="拜訪戰略卡">
      <div className="modal-head"><div><span>VISIT BRIEF · {new Date().toLocaleDateString('zh-TW')}</span><h2>{company.name}</h2><p>AI 關鍵客戶拜訪戰略卡</p></div><button onClick={close}><X size={20} /></button></div>
      <div className="strategy-score"><div className="mini-score"><strong>{company.score}</strong><span>財務評分</span></div><p>{strategy?.executiveSummary || (status === 'loading' ? '正在整合企業資訊、事件訊號與產品關係，產生拜訪假設…' : company.summary)}</p></div>
      <section className="strategy-metrics-section">
        <div className="strategy-metrics-head"><div><span>FINANCIAL SNAPSHOT</span><h3>財務體質快照</h3></div><small>選擇顯示指標 · 最多 5 項</small></div>
        {company.strategyMetrics.length > 0 && <div className="metric-selector">
          {company.strategyMetrics.map((metric) => {
            const selected = metricIds.includes(metric.id)
            return <button key={metric.id} className={selected ? 'selected' : ''} disabled={!selected && metricIds.length >= 5} onClick={() => toggleMetric(metric.id)}><span>{selected && <Check size={11} />}</span>{metric.label}</button>
          })}
        </div>}
        <div className="strategy-metric-grid">
          {company.strategyMetrics.filter((metric) => metricIds.includes(metric.id)).map((metric) => <article key={metric.id}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.note}</small></article>)}
          {company.strategyMetrics.length === 0 && <p className="no-metrics">目前前端尚無可選財務快照；AI 仍會以 EAP 資料庫與企業事件生成戰略。</p>}
          {company.strategyMetrics.length > 0 && metricIds.length === 0 && <p className="no-metrics">請選擇要放入戰略卡的財務指標。</p>}
        </div>
      </section>

      {status === 'loading' && <section className="opening-script"><span>AI ANALYSIS</span><h3>正在產生拜訪戰略</h3><p>系統正在整理公司訊號、需求假設、產品方向與驗證問題。完成前不會以測試資料代替正式結果。</p></section>}

      {status === 'error' && <>
        <section className="opening-script"><span>GENERATION ERROR</span><h3>戰略卡生成失敗</h3><p>{error || 'EAP 暫時無法完成戰略卡生成。'}</p></section>
        <div className="modal-actions"><button className="primary" onClick={retry}><RefreshCw size={16} /> 重新生成</button></div>
      </>}

      {status === 'ready' && strategy && <>
        <div className="strategy-columns">
          <section><h3><TrendingUp size={17} /> 優先切入機會</h3>{strategy.opportunities.map((item, index) => <div className="strategy-point" key={`${item.need}-${index}`}><b>0{index + 1}</b><span><strong>{item.need || '待驗證需求'}</strong><br /><small>訊號：{item.signal || '—'}</small><br /><small>產品方向：{item.product || '待 AO 驗證'}</small><br /><small>判斷依據：{item.rationale || '—'}</small><br /><small>驗證：{item.validationQuestion || '—'}</small></span></div>)}</section>
          <section><h3><CircleAlert size={17} /> 風險與待查證</h3>{strategy.risks.length > 0 ? strategy.risks.map((item) => <div className="risk-point" key={item}><i /><span>{item}</span></div>) : <div className="risk-point"><i /><span>AI 未列出額外風險，仍應依授信與 KYC 流程驗證。</span></div>}</section>
        </div>
        <section className="opening-script"><span>RECOMMENDED OPENING</span><h3>建議開場與探詢</h3><p>{strategy.opening || '請先以近期企業動態作為開場，再逐步驗證資金、交易與風險管理需求。'}</p></section>
        {strategy.evidence.length > 0 && <section className="opening-script"><span>EVIDENCE USED</span><h3>本次判斷依據</h3><p>{strategy.evidence.join('；')}</p></section>}
        <div className="question-chips">{strategy.questions.map((item) => <span key={item}><Check size={13} />{item}</span>)}</div>
        <div className="modal-actions"><button className="secondary" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? '已複製' : '複製內容'}</button><button className="secondary" onClick={retry}><RefreshCw size={16} /> 重新生成</button><button className="primary" onClick={download}><Download size={16} /> 下載戰略卡</button></div>
      </>}
    </div>
  </div>
}

export default App'''
text, modal_count = modal_pattern.subn(new_modal, text, count=1)
if modal_count != 1:
    raise SystemExit(f'StrategyModal replacement: expected 1 match, got {modal_count}')

path.write_text(text, encoding='utf-8')
print('Patched src/App.tsx successfully')
