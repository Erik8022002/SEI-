from pathlib import Path
import re

path = Path('src/App.tsx')
text = path.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, got {count}')
    text = text.replace(old, new, 1)


replace_once(
    "import { generateVisitStrategyCard, visitStrategyToText, type VisitStrategyCard } from './lib/visit-strategy'\n",
    "import { generateVisitStrategyCard, visitStrategyToText, type VisitStrategyCard } from './lib/visit-strategy'\nimport { generateFinancialAssessment, type FinancialAssessmentCard } from './lib/financial-assessment'\n",
    'assessment import',
)

replace_once(
    "  const [strategyChatId, setStrategyChatId] = useState<string | null>(null)\n",
    "  const [strategyChatId, setStrategyChatId] = useState<string | null>(null)\n  const [assessmentStatus, setAssessmentStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')\n  const [financialAssessment, setFinancialAssessment] = useState<FinancialAssessmentCard | null>(null)\n  const [assessmentError, setAssessmentError] = useState('')\n",
    'assessment state',
)

replace_once(
    "  const companyLookupControllerRef = useRef<AbortController | null>(null)\n  const materialEvents = useMaterialEvents(company)\n\n  useEffect(() => {\n",
    """  const companyLookupControllerRef = useRef<AbortController | null>(null)
  const assessmentRequestRef = useRef(0)
  const materialEvents = useMaterialEvents(company)

  const refreshFinancialAssessment = async () => {
    const requestId = ++assessmentRequestRef.current
    const targetCompany = company
    setAssessmentStatus('loading')
    setAssessmentError('')
    setFinancialAssessment(null)
    setCompany((current) => current.id === targetCompany.id ? {
      ...current,
      score: 0,
      scoreLabel: '評估中',
      scores: [],
    } : current)

    try {
      const result = await generateFinancialAssessment({
        apiBaseUrl: API_BASE_URL,
        projectId: PROJECT_ID,
        projectToken: PROJECT_TOKEN,
        company: targetCompany,
      })
      if (assessmentRequestRef.current != requestId) return

      setFinancialAssessment(result)
      setAssessmentStatus('ready')
      setCompany((current) => current.id === targetCompany.id ? {
        ...current,
        score: result.score ?? 0,
        scoreLabel: result.label,
        scores: result.dimensions
          .filter((item) => item.score !== null)
          .map((item) => ({ label: item.label, value: item.score as number })),
      } : current)
    } catch (error) {
      if (assessmentRequestRef.current != requestId) return
      console.error('財務綜合評估失敗:', error)
      setAssessmentError(error instanceof Error ? error.message : '財務評估暫時無法完成')
      setAssessmentStatus('error')
      setCompany((current) => current.id === targetCompany.id ? {
        ...current,
        score: 0,
        scoreLabel: '評估暫不可用',
        scores: [],
      } : current)
    }
  }

  useEffect(() => {
    void refreshFinancialAssessment()
    return () => {
      assessmentRequestRef.current += 1
    }
    // Company identity is the assessment boundary; later profile syncs should not trigger duplicate EAP calls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id, company.ticker])

  useEffect(() => {
""",
    'assessment runner',
)

replace_once(
    "    setStrategyChatId(null)\n    setEventMode('realtime')\n",
    "    setStrategyChatId(null)\n    setAssessmentStatus('idle')\n    setFinancialAssessment(null)\n    setAssessmentError('')\n    setEventMode('realtime')\n",
    'assessment reset',
)

score_pattern = re.compile(
    r'''            <article className="score-card panel">\n              <div className="panel-kicker">FINANCIAL HEALTH</div>[\s\S]*?            </article>\n\n            <article className="brief-card panel">'''
)
score_replacement = '''            <article className="score-card panel">
              <div className="panel-kicker">FINANCIAL HEALTH · EVIDENCE BASED</div>
              <div className="score-main">
                <div className="score-ring" style={{ '--score': financialAssessment?.score ?? 0 } as React.CSSProperties}>
                  <div>
                    <strong>{assessmentStatus === 'loading' ? '…' : financialAssessment?.score ?? '--'}</strong>
                    {financialAssessment?.score !== null && financialAssessment?.score !== undefined && <small>/ 100</small>}
                  </div>
                </div>
                <div className="score-copy">
                  <span><ShieldCheck size={16} /> 綜合評估</span>
                  <h3>{assessmentStatus === 'loading' ? '正在評估財務體質' : assessmentStatus === 'error' ? '評估暫不可用' : financialAssessment?.label ?? '等待財務資料'}</h3>
                  <p>
                    {assessmentStatus === 'loading'
                      ? '正在查詢財務指標、損益、資產負債與現金流資料。'
                      : assessmentStatus === 'error'
                        ? assessmentError
                        : financialAssessment
                          ? `資料完整度 ${financialAssessment.completeness}% · ${financialAssessment.asOf} · 固定門檻評估，非同業百分位`
                          : '尚未完成財務綜合評估。'}
                  </p>
                </div>
              </div>
              <div className="score-bars">
                {financialAssessment?.dimensions.map((dimension) => <div key={dimension.label} title={dimension.note}><span>{dimension.label}</span><div><i style={{ width: `${dimension.score ?? 0}%` }} /></div><b>{dimension.score ?? '—'}</b></div>)}
                {assessmentStatus === 'error' && <button className="text-link" onClick={() => void refreshFinancialAssessment()}><RefreshCw size={13} />重新評估</button>}
              </div>
              {financialAssessment?.summary && <p className="source-note">{financialAssessment.summary}</p>}
            </article>

            <article className="brief-card panel">'''
text, count = score_pattern.subn(score_replacement, text, count=1)
if count != 1:
    raise SystemExit(f'score card: expected exactly 1 match, got {count}')

replace_once(
    '<AdvancedStats company={company} metrics={displayedMetrics} periodLabel={selectedPeriod.label} />',
    '<AdvancedStats company={company} metrics={displayedMetrics} periodLabel={selectedPeriod.label} assessmentStatus={assessmentStatus} />',
    'advanced stats assessment status',
)

path.write_text(text, encoding='utf-8')
print('Patched src/App.tsx financial assessment flow successfully')
