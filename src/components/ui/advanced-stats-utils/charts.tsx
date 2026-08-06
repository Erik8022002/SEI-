'use client'

import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { cn } from '@/lib/utils'

type TrendPoint = {
  quarter: string
  revenue: number
  profit: number
}

type ChartMetric = 'revenue' | 'profit'

const chartConfig = {
  revenue: {
    label: '營業收入',
    color: '#ce8333',
  },
  profit: {
    label: '稅後淨利',
    color: '#2b725d',
  },
} satisfies ChartConfig

const metricOptions: { key: ChartMetric; label: string }[] = [
  { key: 'revenue', label: '營業收入' },
  { key: 'profit', label: '稅後淨利' },
]

export function ClippedAreaChart({
  data,
  companyName,
  periodLabel,
  compact = false,
}: {
  data: TrendPoint[]
  companyName: string
  periodLabel: string
  compact?: boolean
}) {
  const [activeMetric, setActiveMetric] = useState<ChartMetric>('revenue')
  const metric = chartConfig[activeMetric]

  const summary = useMemo(() => {
    const first = data[0]?.[activeMetric] ?? 0
    const latest = data.at(-1)?.[activeMetric] ?? 0
    const change = first === 0 ? 0 : ((latest - first) / Math.abs(first)) * 100
    return { latest, change }
  }, [activeMetric, data])

  return (
    <div className={cn('flex h-full flex-col', compact ? 'min-h-[332px]' : 'min-h-[360px]')}>
      <div className={cn('flex flex-col gap-4 sm:flex-row sm:justify-between', compact ? 'mb-3 sm:items-center' : 'mb-5 sm:items-start')}>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a37845]">
            {compact ? 'Performance trend' : `${companyName} · ${periodLabel}`}
          </p>
          {compact ? (
            <h3 className="text-sm font-bold text-[#14201c]">
              {companyName} · {periodLabel}趨勢
            </h3>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <strong className="text-3xl font-black tracking-[-0.04em] text-[#14201c]">
                  {summary.latest.toLocaleString('zh-TW', { maximumFractionDigits: 1 })}
                </strong>
                <span className="text-xs font-medium text-[#717b77]">億元</span>
              </div>
              <p className={cn('mt-1 text-xs font-semibold', summary.change >= 0 ? 'text-emerald-700' : 'text-rose-600')}>
                {summary.change >= 0 ? '+' : ''}{summary.change.toFixed(1)}% · 六季變化
              </p>
            </>
          )}
        </div>

        <div className="inline-flex self-start rounded-lg border border-[#dcdad3] bg-white p-1" aria-label="切換圖表指標">
          {metricOptions.map((option) => (
            <button
              type="button"
              key={option.key}
              aria-pressed={activeMetric === option.key}
              onClick={() => setActiveMetric(option.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-[10px] font-bold transition-colors',
                activeMetric === option.key
                  ? 'bg-[#164b3d] text-white shadow-sm'
                  : 'text-[#717b77] hover:bg-[#efede7] hover:text-[#14201c]',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={cn(
          'min-h-0 flex-1 overflow-hidden rounded-2xl px-1 pt-4',
          compact
            ? 'bg-[radial-gradient(circle,_rgba(20,32,28,0.11)_1px,_transparent_1px)] [background-size:18px_18px]'
            : 'bg-white/60',
        )}
      >
        <ChartContainer
          config={chartConfig}
          className={cn('w-full aspect-auto', compact ? 'h-[265px]' : 'h-[250px]')}
          role="img"
          aria-label={`${companyName}${metric.label}近六季趨勢圖`}
        >
          <AreaChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="advancedStatsRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-revenue)" stopOpacity={compact ? 0.16 : 0.34} />
                <stop offset="100%" stopColor="var(--color-revenue)" stopOpacity={compact ? 0 : 0.02} />
              </linearGradient>
              <linearGradient id="advancedStatsProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-profit)" stopOpacity={compact ? 0.14 : 0.3} />
                <stop offset="100%" stopColor="var(--color-profit)" stopOpacity={compact ? 0 : 0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={compact ? '#dddcd6' : '#e5e3dd'} strokeDasharray={compact ? '1 7' : '3 5'} />
            <XAxis
              dataKey="quarter"
              axisLine={false}
              tickLine={false}
              tickMargin={12}
              minTickGap={20}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickMargin={8}
              width={48}
              tickFormatter={(value) => Number(value).toLocaleString('zh-TW', { notation: 'compact' })}
            />
            <ChartTooltip
              cursor={{ stroke: '#b9b8b1', strokeDasharray: '3 3' }}
              content={<ChartTooltipContent indicator="line" />}
            />
            <Area
              key={activeMetric}
              dataKey={activeMetric}
              type="monotone"
              fill={`url(#advancedStats${activeMetric === 'revenue' ? 'Revenue' : 'Profit'})`}
              fillOpacity={1}
              stroke={`var(--color-${activeMetric})`}
              strokeWidth={compact ? 2.5 : 3}
              dot={compact ? false : { fill: '#f8f7f3', stroke: `var(--color-${activeMetric})`, strokeWidth: 2, r: 3.5 }}
              activeDot={{ r: 5, strokeWidth: 2, fill: '#ffffff' }}
              isAnimationActive
              animationDuration={650}
            />
          </AreaChart>
        </ChartContainer>
      </div>
    </div>
  )
}
