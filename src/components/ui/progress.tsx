'use client'

import React from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'

import { cn } from '@/lib/utils'

interface Vo2MaxCardProps {
  /** The main title of the card. */
  title: string
  /** The primary percentage value to display. */
  value: number
  /** The benchmark label shown beside the value. */
  status: string
  /** The small uppercase label above the title. */
  description: React.ReactNode
  /** The percentage represented by the gauge needle. */
  progress: number
  /** An icon displayed in the top-right corner. */
  icon: React.ReactNode
  /** Optional classes merged with the card styles. */
  className?: string
  /** Uses the lighter, sidebar-sized presentation. */
  compact?: boolean
}

export const Vo2MaxCard: React.FC<Vo2MaxCardProps> = ({
  title,
  value,
  status,
  description,
  progress,
  icon,
  className,
  compact = false,
}) => {
  const reduceMotion = useReducedMotion()
  const count = useMotionValue(reduceMotion ? value : 0)
  const rounded = useTransform(count, (latest) => Math.round(latest))
  const clampedProgress = Math.min(Math.max(progress, 0), 100)
  const needleRotation = -90 + clampedProgress * 1.8

  React.useEffect(() => {
    const duration = reduceMotion ? 0 : 1.25
    const valueAnimation = animate(count, value, {
      duration,
      ease: [0.43, 0.13, 0.23, 0.96],
    })

    return () => {
      valueAnimation.stop()
    }
  }, [count, reduceMotion, value])

  return (
    <div
      className={cn(
        'relative flex w-full flex-col overflow-hidden bg-[#164b3d] text-white',
        compact
          ? 'min-h-[238px] rounded-3xl p-5 shadow-[0_15px_34px_rgba(22,75,61,0.14)]'
          : 'min-h-[300px] rounded-[2.75rem] p-7 shadow-[0_24px_55px_rgba(22,75,61,0.2)] sm:min-h-[330px] sm:p-8',
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-white/[0.035] blur-2xl" />

      <div className="relative flex items-start justify-between gap-5">
        <div>
          <div className={cn('font-bold uppercase text-[#e7ad63]', compact ? 'mb-1.5 text-[8px] tracking-[0.2em]' : 'mb-2 text-[9px] tracking-[0.24em] sm:text-[10px]')}>
            {description}
          </div>
          <h3 className={cn('font-bold tracking-[-0.025em]', compact ? 'text-base' : 'text-xl sm:text-2xl')}>{title}</h3>
        </div>
        <div className={cn('mt-1 flex shrink-0 items-center justify-center text-white/45', compact ? 'size-7' : 'size-9')}>
          {icon}
        </div>
      </div>

      <div className={cn('relative mt-auto flex flex-col', compact ? 'pt-1' : 'pt-4')}>
        <svg
          viewBox="0 0 260 140"
          className={cn('mx-auto w-full overflow-visible', compact ? 'max-w-[205px]' : 'max-w-[270px]')}
          role="progressbar"
          aria-label={title}
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <path
            d="M 30 120 A 100 100 0 0 1 230 120"
            fill="none"
            stroke="rgba(255,255,255,.14)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <motion.path
            d="M 30 120 A 100 100 0 0 1 230 120"
            fill="none"
            stroke="#e6aa58"
            strokeWidth="13"
            strokeLinecap="round"
            pathLength={1}
            initial={reduceMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: clampedProgress / 100 }}
            transition={{ duration: reduceMotion ? 0 : 1.25, ease: [0.43, 0.13, 0.23, 0.96] }}
          />
          {[0, 25, 50, 75, 100].map((tick) => {
            const angle = Math.PI - (tick / 100) * Math.PI
            const x1 = 130 + 84 * Math.cos(angle)
            const y1 = 120 - 84 * Math.sin(angle)
            const x2 = 130 + 91 * Math.cos(angle)
            const y2 = 120 - 91 * Math.sin(angle)
            return <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,.5)" strokeWidth="2" strokeLinecap="round" />
          })}
          <motion.g
            initial={reduceMotion ? false : { rotate: -90 }}
            animate={{ rotate: needleRotation }}
            transition={{ duration: reduceMotion ? 0 : 1.25, ease: [0.43, 0.13, 0.23, 0.96] }}
            style={{ transformOrigin: '130px 120px' }}
          >
            <line x1="130" y1="120" x2="130" y2="48" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
            <circle cx="130" cy="120" r="9" fill="#164b3d" stroke="#ffffff" strokeWidth="4" />
          </motion.g>
          <text x="25" y="138" fill="rgba(255,255,255,.48)" fontSize="9">0</text>
          <text x="226" y="138" fill="rgba(255,255,255,.48)" fontSize="9">100</text>
        </svg>

        <div className={cn('flex items-end justify-between', compact ? '-mt-1 gap-2' : 'mt-1 gap-4')}>
          <div className="flex items-end leading-none">
            <motion.span className={cn('font-bold tracking-[-0.06em]', compact ? 'text-4xl' : 'text-5xl sm:text-6xl')}>
              {rounded}
            </motion.span>
            <span className={cn('pb-0.5 font-bold tracking-[-0.04em]', compact ? 'text-xl' : 'text-2xl sm:text-3xl')}>%</span>
          </div>
          <span className={cn('mb-0.5 rounded-full border border-white/20 bg-white/10 font-bold tracking-wide text-white', compact ? 'px-2.5 py-1 text-[9px]' : 'px-3 py-1.5 text-[10px] sm:text-xs')}>
            {status}
          </span>
        </div>
      </div>
    </div>
  )
}
