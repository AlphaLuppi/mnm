import { useEffect, useRef, useState } from 'react'

type AnimatedCounterProps = {
  value: number
  className?: string
  duration?: number
}

export function AnimatedCounter({ value, className = '', duration = 300 }: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(value)
  const prevValueRef = useRef(value)
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  )

  useEffect(() => {
    if (prefersReducedMotion.current || prevValueRef.current === value) {
      setDisplayValue(value)
      prevValueRef.current = value
      return
    }

    const startValue = prevValueRef.current
    const diff = value - startValue
    const startTime = performance.now()

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(Math.round(startValue + diff * eased))

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
    prevValueRef.current = value
  }, [value, duration])

  return <span className={className}>{displayValue}</span>
}
