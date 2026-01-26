"use client"

import { Area, AreaChart, XAxis, YAxis, ResponsiveContainer, ReferenceLine } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

interface StockChartProps {
  data: { time: string; price: number }[]
  isUp: boolean
  costPrice?: number
  timeRange?: string
}

export function StockChart({ data, isUp, costPrice, timeRange }: StockChartProps) {
  const chartColor = isUp ? "#ef4444" : "#22c55e"
  const gradientId = isUp ? "fillUp" : "fillDown"

  // 对于 1D（一日线），填充完整的交易时间轴
  let chartData = data
  if (timeRange === "1D" && data.length > 0) {
    // 生成完整的交易时间点（9:30-15:00，每5分钟）
    const fullTimeSlots: string[] = []
    const today = data[0].time.split(" ")[0] // 获取日期部分

    // 上午：9:30-11:30
    for (let h = 9; h <= 11; h++) {
      const startMin = h === 9 ? 30 : 0
      const endMin = h === 11 ? 30 : 55
      for (let m = startMin; m <= endMin; m += 5) {
        fullTimeSlots.push(`${today} ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`)
      }
    }

    // 下午：13:00-15:00
    for (let h = 13; h <= 15; h++) {
      const endMin = h === 15 ? 0 : 55
      for (let m = 0; m <= endMin; m += 5) {
        fullTimeSlots.push(`${today} ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`)
      }
    }

    // 创建时间到价格的映射
    const priceMap = new Map(data.map(d => [d.time, d.price]))

    // 填充数据，没有数据的时间点设为 null
    chartData = fullTimeSlots.map(time => ({
      time,
      price: priceMap.get(time) ?? (null as any)
    }))
  }

  const validPrices = chartData.filter(d => d.price !== null).map(d => d.price)
  const minPrice = Math.min(...validPrices)
  const maxPrice = Math.max(...validPrices)
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
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
              // 日内数据：只显示时间 (如 "11:10")
              if (value.includes(" ")) {
                const timePart = value.split(" ")[1]
                return timePart ? timePart.slice(0, 5) : value
              }
              // 日期格式
              if (value.includes("-") && value.length === 10) {
                // 全部数据：显示年月 (如 "24/01")
                if (timeRange === "ALL") {
                  const year = value.slice(2, 4)
                  const month = value.slice(5, 7)
                  return `${year}/${month}`
                }
                // 其他周期：显示月-日 (如 "01-23")
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
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
