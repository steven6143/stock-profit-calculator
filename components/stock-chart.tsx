"use client"

import { Area, AreaChart, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip } from "recharts"
import { ChartContainer } from "@/components/ui/chart"

interface StockChartProps {
  data: { time: string; price: number }[]
  isUp: boolean
  costPrice?: number
  timeRange?: string
}

// 获取当前北京时间的日期字符串
function getTodayBeijing(): string {
  const now = new Date()
  const beijingTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }))
  const year = beijingTime.getFullYear()
  const month = (beijingTime.getMonth() + 1).toString().padStart(2, '0')
  const day = beijingTime.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function StockChart({ data, isUp, costPrice, timeRange }: StockChartProps) {
  const chartColor = isUp ? "#ef4444" : "#22c55e"
  const gradientId = isUp ? "fillUp" : "fillDown"

  // 对于 1D（一日线），填充完整的交易时间轴
  let chartData = data
  let keyTicks: string[] = [] // 关键时间点用于 X 轴显示

  if (timeRange === "1D" && data.length > 0) {
    // 使用当前北京时间的日期
    const today = getTodayBeijing()

    // 获取当前北京时间
    const now = new Date()
    const beijingNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }))
    const currentHour = beijingNow.getHours()
    const currentMin = beijingNow.getMinutes()
    const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`

    // 生成完整的交易时间点（9:30-15:00，每5分钟）
    const fullTimeSlots: string[] = []

    // 上午：9:30-11:30
    for (let h = 9; h <= 11; h++) {
      const startMin = h === 9 ? 30 : 0
      const endMin = h === 11 ? 30 : 55
      for (let m = startMin; m <= endMin; m += 5) {
        fullTimeSlots.push(`${today} ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`)
      }
    }

    // 下午：13:00-15:00
    for (let h = 13; h <= 15; h++) {
      const endMin = h === 15 ? 0 : 55
      for (let m = 0; m <= endMin; m += 5) {
        fullTimeSlots.push(`${today} ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`)
      }
    }

    // 关键时间点：4个点，中间两个位置用一个点表示
    keyTicks = [
      `${today} 09:30:00`,
      `${today} 11:30:00`,  // 会显示为 "11:30/13:00"
      `${today} 15:00:00`
    ]

    // 创建时间到价格的映射
    // 只使用今天日期的数据，忽略历史数据
    const priceMap = new Map<string, number>()
    data.forEach(d => {
      const datePart = d.time.split(" ")[0]
      const timePart = d.time.split(" ")[1]?.slice(0, 5)
      // 只接受今天的数据
      if (datePart === today && timePart) {
        const normalizedTime = `${today} ${timePart}:00`
        priceMap.set(normalizedTime, d.price)
      }
    })

    // 填充数据，只显示当前时间之前的数据点
    chartData = fullTimeSlots.map(time => {
      const timeOnly = time.split(" ")[1]?.slice(0, 5) || ""
      // 如果时间点在当前时间之后，设为 null
      const isFuture = timeOnly > currentTimeStr
      return {
        time,
        price: isFuture ? (null as any) : (priceMap.get(time) ?? (null as any))
      }
    })
  }

  const validPrices = chartData.filter(d => d.price !== null).map(d => d.price)
  const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0
  const maxPrice = validPrices.length > 0 ? Math.max(...validPrices) : 100
  const padding = (maxPrice - minPrice) * 0.1 || 1
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
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
            ticks={timeRange === "1D" ? keyTicks : undefined}
            tickFormatter={(value) => {
              // 1D 模式：只显示时间
              if (timeRange === "1D" && value.includes(" ")) {
                const timePart = value.split(" ")[1]?.slice(0, 5)
                // 11:30 显示为 "11:30/13:00"
                if (timePart === "11:30") {
                  return "11:30/13:00"
                }
                return timePart || value
              }
              // 日期格式 (如 "2026-01-23")
              if (value.includes("-") && value.length >= 10) {
                const dateStr = value.slice(0, 10)
                // 全部数据：显示年月 (如 "24/01")
                if (timeRange === "ALL") {
                  const year = dateStr.slice(2, 4)
                  const month = dateStr.slice(5, 7)
                  return `${year}/${month}`
                }
                // 其他周期：显示月-日 (如 "01-23")
                return dateStr.slice(5)
              }
              return value
            }}
            interval={timeRange === "1D" ? 0 : "preserveStartEnd"}
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
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length && payload[0].value != null) {
                const time = payload[0].payload.time
                const displayTime = timeRange === "1D" && time.includes(" ")
                  ? time.split(" ")[1]?.slice(0, 5)
                  : time.slice(0, 10)
                return (
                  <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md">
                    <p className="text-sm text-muted-foreground">{displayTime}</p>
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
