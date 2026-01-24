"use client"

import { cn } from "@/lib/utils"

interface TimeRangeSelectorProps {
  selected: string
  onSelect: (range: string) => void
  isFund?: boolean
}

const stockTimeRanges = [
  { label: "1日", value: "1D" },
  { label: "1周", value: "1W" },
  { label: "1月", value: "1M" },
  { label: "3月", value: "3M" },
  { label: "1年", value: "1Y" },
  { label: "4年", value: "ALL" },
]

const fundTimeRanges = [
  { label: "1周", value: "1W" },
  { label: "1月", value: "1M" },
  { label: "3月", value: "3M" },
  { label: "1年", value: "1Y" },
  { label: "4年", value: "ALL" },
]

export function TimeRangeSelector({ selected, onSelect, isFund = false }: TimeRangeSelectorProps) {
  const timeRanges = isFund ? fundTimeRanges : stockTimeRanges

  return (
    <div className="flex items-center justify-center gap-1 rounded-xl bg-secondary p-1">
      {timeRanges.map((range) => (
        <button
          key={range.value}
          onClick={() => onSelect(range.value)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
            selected === range.value
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {range.label}
        </button>
      ))}
    </div>
  )
}
