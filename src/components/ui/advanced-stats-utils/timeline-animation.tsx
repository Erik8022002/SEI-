'use client'

import React, { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

type TimelineAnimationProps = React.HTMLAttributes<HTMLDivElement> & {
  animationNum: number
  timelineRef: React.RefObject<HTMLDivElement | null>
  children: React.ReactNode
}

export function TimelineAnimation({
  animationNum,
  timelineRef,
  className,
  children,
  style,
  ...props
}: TimelineAnimationProps) {
  const [visible, setVisible] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const target = timelineRef.current
    if (!target) return

    if (visible) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [timelineRef, visible])

  return (
    <div
      className={cn(
        'transition-[opacity,transform] duration-700 ease-out will-change-[opacity,transform]',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0',
        className,
      )}
      style={{ transitionDelay: `${Math.min(animationNum, 8) * 65}ms`, ...style }}
      {...props}
    >
      {children}
    </div>
  )
}
