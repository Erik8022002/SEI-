import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import { companies, type Company, type FinancialMetric } from '@/data'

type AdvancedStatsProps = {
  company?: Company
  metrics?: FinancialMetric[]
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
}: AdvancedStatsProps) {
  return (
    <section
      aria-label={`${company.name}核心財務指標`}
      className="font-dmSans w-full py-1"
    >
      {metrics.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => {
            const favorable = isFavorable(metric)
            return (
              <article key={metric.label} className="min-w-0 rounded-2xl border border-[#dedcd6] bg-[#fbfaf7] p-5 shadow-[0_8px_22px_rgba(20,32,28,0.035)]">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <p className="min-h-7 text-[10px] font-bold uppercase leading-3.5 tracking-[0.11em] text-[#7f8884]">{metric.label}</p>
                  <span className={cn('inline-flex shrink-0 items-center gap-0.5 rounded-full border px-2 py-1 text-[9px] font-bold', favorable ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700')}>
                    {metric.delta >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                    {Math.abs(metric.delta).toLocaleString('zh-TW', { maximumFractionDigits: 1 })}%
                  </span>
                </div>
                <p className="truncate text-xl font-black tracking-[-0.04em] text-[#14201c]">{formatMetric(metric)}</p>
                <p className="mt-1.5 text-[10px] text-[#929995]">{metric.note}</p>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#d7d4cc] bg-[#fbfaf7] px-5 py-8 text-center text-xs text-[#87908c]">
          點選上市公司後，將在此顯示 TWSE 官方財務指標。
        </div>
      )}
    </section>
  )
}
