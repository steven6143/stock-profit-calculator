"use client"

import { Area, AreaChart, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface StockChartProps {
  data: { time: string; price: number }[]
  isUp: boolean
  costPrice?: number
}

export function StockChart({ data, isUp, costPrice }: StockChartProps) {
  const chartColor = isUp ? "#ef4444" : "#22c55e"
  const gradientId = isUp ? "fillUp" : "fillDown"

  const minPrice = Math.min(...data.map((d) => d.price))
  const maxPrice = Math.max(...data.map((d) => d.price))
  const padding = (maxPrice - minPrice) * 0.1
  const yDomain = [minPrice - padding, maxPrice + padding]

  // Include cost price in domain calculation if provided
  if (costPrice !== undefined) {
    yDomain[0] = Math.min(yDomain[0], costPrice - padding)
    yDomain[1] = Math.max(yDomain[1], costPrice + padding)
  }

  return (
    <ChartContainer
      config={{
        price: {
          label: "价格",
          color: chartColor,
        },
      }}
      className="h-[300px] w-full md:h-[400px]"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#6b7280", fontSize: 10 }}
            tickMargin={8}
            tickFormatter={(value) => {
              // 只显示时间部分，不显示日期
              if (value.includes(" ")) {
                const timePart = value.split(" ")[1]
                // 只保留小时:分钟
                return timePart ? timePart.slice(0, 5) : value
              }
              // 如果是日期格式（如 2026-01-23），只显示月-日
              if (value.includes("-") && value.length === 10) {
                return value.slice(5)
              }
              return value
            }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={yDomain}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#6b7280", fontSize: 12 }}
            tickMargin={10}
            tickFormatter={(value) => `¥${value.toFixed(2)}`}
            width={70}
          />
          <ChartTooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md">
                    <p className="text-sm text-muted-foreground">{payload[0].payload.time}</p>
                    <p className="text-base font-semibold text-foreground">
                      ¥{Number(payload[0].value).toFixed(2)}
                    </p>
                  </div>
                )
              }
              return null
            }}
          />
          {costPrice !== undefined && (
            <ReferenceLine
              y={costPrice}
              stroke="#facc15"
              strokeDasharray="5 5"
              strokeWidth={2}
              label={{
                value: `¥${costPrice.toFixed(2)}`,
                position: "insideTopLeft",
                fill: "#facc15",
                fontSize: 10,
                offset: 5,
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="price"
            stroke={chartColor}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
