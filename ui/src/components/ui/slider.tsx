import * as React from "react"

import { cn } from "@/lib/utils"

interface SliderProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "defaultValue"> {
  value: number[]
  min?: number
  max?: number
  step?: number
  onValueChange?: (value: number[]) => void
  onValueCommit?: (value: number[]) => void
}

function Slider({
  className,
  value,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  onValueCommit,
  disabled,
  ...props
}: SliderProps) {
  const current = value[0] ?? 0
  const commit = () => onValueCommit?.([current])
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={current}
      disabled={disabled}
      onChange={(e) => onValueChange?.([Number(e.target.value)])}
      onMouseUp={commit}
      onTouchEnd={commit}
      onKeyUp={commit}
      className={cn(
        "h-2 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

export { Slider }
