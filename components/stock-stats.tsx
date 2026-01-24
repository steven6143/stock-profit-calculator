"use client"

import { Card, CardContent } from "@/components/ui/card"

interface StockStatsProps {
  open: number
  high: number
  low: number
  volume: number
  marketCap: string
  pe: number
}

export function StockStats({ open, high, low, volume, marketCap, pe }: StockStatsProps) {
  const stats = [
    { label: "今开", value: `¥${open.toFixed(2)}` },
    { label: "最高", value: `¥${high.toFixed(2)}` },
    { label: "最低", value: `¥${low.toFixed(2)}` },
    { label: "成交量", value: `${(volume / 10000).toFixed(2)}万` },
    { label: "市值", value: marketCap },
    { label: "市盈率", value: pe.toFixed(2) },
  ]

  return (
    <Card className="border-border/50 bg-card">
      <CardContent className="grid grid-cols-2 gap-4 p-4 md:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="space-y-1">
            <div className="text-xs text-muted-foreground">{stat.label}</div>
            <div className="font-mono text-sm font-medium text-foreground">{stat.value}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
