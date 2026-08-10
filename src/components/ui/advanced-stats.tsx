'use client'

import React, { useRef } from 'react'
import { ArrowDownRight, ArrowUpRight, Gauge, TrendingUp } from 'lucide-react'

import { ClippedAreaChart } from '@/components/ui/advanced-stats-utils/charts'
import { TimelineAnimation } from '@/components/ui/advanced-stats-utils/timeline-animation'
import { FinancialGaugeCard } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { companies, type Company, type FinancialMetric } from '@/data'

type AdvancedStatsProps = {
  company?: Company
  metrics?: FinancialMetric[]
  periodLabel?: string
  assessmentStatus?: 'idle' | 'loading' | 'ready' | 'error'
}

function formatMetric(metric: FinancialMetric) {
  const value = metric.value.toLocaleString('zh-TW', { maximumFractionDigits: 1 })
  return `${value} ${metric.suffix}`
}

function isFavorable(metric: FinancialMetric) {
  if (metric.label.includes('負債')) return metric.delta <= 0
  return metric.delta >= 0
}

export default function AdvancedStats({
  company = companies[0],
  metrics = company.metrics,
  periodLabel = '近一年',
  assessmentStatus = 'ready',
}: AdvancedStatsProps) {
  const timelineRef = useRef<HTMLDivElement>(null)
  const growthScore = company.scores.find((score) => score.label === '獲利與成長')?.value ?? null
  const revenueDelta = company.metrics[0]?.delta ?? null
  const assessmentReady = assessmentStatus === 'ready' && company.score > 0
  const gaugeStatus = assessmentStatus === 'loading'
    ? '評估中'
    : assessmentStatus === 'error'
      ? '暫不可用'
      : company.scoreLabel || '資料不足'

  return (
    <section
      ref={timelineRef}
      aria-label={`${company.name}進階財務統計`}
      className="font-dmSans flex w-full flex-col gap-5 py-1"
    >
      <div className="w-full">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_17.5rem]">
          <TimelineAnimation
            animationNum={1}
            timelineRef={timelineRef}
            className="overflow-hidden rounded-3xl border border-[#dcdad3] bg-[#fbfaf7] shadow-[0_14px_38px_rgba(20,32,28,0.045)]"
          >
            <div className="grid grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric, index) => {
                const favorable = isFavorable(metric)

                return (
                  <article
                    key={metric.label}
                    className={cn(
                      'min-w-0 border-[#dedcd6] p-4 sm:p-5',
                      'border-b border-r',
                      index % 2 === 1 && 'border-r-0',
                      index >= 2 && 'border-b-0',
                      'xl:border-b-0',
                      index < metrics.length - 1 ? 'xl:border-r' : 'xl:border-r-0',
                    )}
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <p className="min-h-7 text-[9px] font-bold uppercase leading-3.5 tracking-[0.11em] text-[#7f8884] sm:text-[10px]">
                        {metric.label}
                      </p>
                      <span
                        className={cn(
                          'inline-flex shrink-0 items-center gap-0.5 rounded-full border px-2 py-1 text-[9px] font-bold',
                          favorable
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-rose-200 bg-rose-50 text-rose-700',
                        )}
                      >
                        {metric.delta >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                        {Math.abs(metric.delta)}%
                      </span>
                    </div>
                    <p className="truncate text-lg font-black tracking-[-0.04em] text-[#14201c] sm:text-xl">
                      {formatMetric(metric)}
                    </p>
                    <p className="mt-1.5 text-[10px] text-[#929995]">{metric.note}</p>
                  </article>
                )
              })}
            </div>

            <div className="border-t border-[#dedcd6] p-4 sm:p-6">
              <ClippedAreaChart
                data={company.trend}
                companyName={company.name}
                periodLabel={periodLabel}
                compact
              />
            </div>
          </TimelineAnimation>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:content-start">
            <TimelineAnimation animationNum={2} timelineRef={timelineRef} className="h-full sm:col-span-1">
              <FinancialGaugeCard
                title="財務綜合評估"
                value={assessmentReady ? company.score : null}
                progress={assessmentReady ? company.score : null}
                status={gaugeStatus}
                description="Evidence-based score"
                unit="分"
                icon={<Gauge size={27} strokeWidth={1.7} aria-hidden="true" />}
                compact
                className="h-full"
              />
            </TimelineAnimation>

            <TimelineAnimation
              animationNum={3}
              timelineRef={timelineRef}
              className="h-full rounded-3xl border border-[#dcdad3] bg-[#fbfaf7] p-5 shadow-[0_10px_28px_rgba(20,32,28,0.035)]"
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg border border-[#dcdad3] bg-white text-[#164b3d]">
                  <TrendingUp size={16} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-[#a37845]">Profit & growth</p>
                  <h3 className="text-sm font-bold text-[#14201c]">獲利與成長</h3>
                </div>
              </div>
              {growthScore === null ? (
                <p className="text-xs leading-5 text-[#717b77]">目前沒有足夠且期間一致的資料，因此不以總分代替獲利與成長構面。</p>
              ) : (
                <p className="text-xs leading-5 text-[#717b77]">
                  {revenueDelta === null ? '營收年增率暫無資料' : <>營收同期變化{' '}<span className={cn('font-bold', revenueDelta >= 0 ? 'text-emerald-700' : 'text-rose-600')}>{revenueDelta >= 0 ? '+' : ''}{revenueDelta}%</span></>}
                  ，獲利與成長構面為 <span className="font-bold text-[#14201c]">{growthScore} 分</span>。
                </p>
              )}
            </TimelineAnimation>
          </div>
        </div>
      </div>
    </section>
  )
}
