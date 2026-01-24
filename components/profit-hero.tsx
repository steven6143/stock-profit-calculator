"use client"

import { Button } from "@/components/ui/button"
import { Settings2, TrendingUp, TrendingDown } from "lucide-react"
import type { AssetType } from "@/lib/types/stock"

interface ProfitHeroProps {
  currentPrice: number
  costPrice: string
  shares: string
  stockName: string
  stockSymbol: string
  change: number
  changePercent: number
  onEditClick: () => void
  assetType?: AssetType
}

export function ProfitHero({
  currentPrice,
  costPrice,
  shares,
  stockName,
  stockSymbol,
  change,
  changePercent,
  onEditClick,
  assetType = "stock",
}: ProfitHeroProps) {
  const cost = parseFloat(costPrice) || 0
  const sharesNum = parseFloat(shares) || 0
  const hasPosition = cost > 0 && sharesNum > 0
  const isFund = assetType === "fund"

  const totalCost = cost * sharesNum
  const currentValue = currentPrice * sharesNum
  const profit = currentValue - totalCost
  const profitPercent = totalCost > 0 ? (profit / totalCost) * 100 : 0
  const isProfit = profit >= 0
  const isStockUp = change >= 0

  // 未设置持仓时的界面
  if (!hasPosition) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-muted-foreground">设置您的持仓信息</p>
        <p className="mt-1 text-sm text-muted-foreground/70">
          输入成本价和{isFund ? "份额" : "股数"}，即可追踪盈亏
        </p>
        <Button
          variant="outline"
          onClick={onEditClick}
          className="mt-4 border-border/50 bg-transparent text-foreground hover:bg-secondary"
        >
          <Settings2 className="mr-2 h-4 w-4" />
          设置持仓
        </Button>

        {/* 资产信息显示在下方 */}
        <div className="mt-8 border-t border-border/30 pt-6">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>{stockName}</span>
            <span className="text-muted-foreground/50">{stockSymbol}</span>
            {isFund && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">基金</span>
            )}
          </div>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="font-mono text-2xl font-semibold text-foreground">
              ¥{currentPrice.toFixed(isFund ? 4 : 2)}
            </span>
            <span className={`text-sm ${isStockUp ? "text-stock-up" : "text-stock-down"}`}>
              {isStockUp ? "+" : ""}{change.toFixed(isFund ? 4 : 2)} ({isStockUp ? "+" : ""}{changePercent.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>
    )
  }

  // 已设置持仓时的界面 - 盈利信息为核心
  return (
    <div className="flex flex-col items-center py-4">
      {/* 核心盈亏数字 */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">持仓盈亏</p>
        <div className={`mt-2 flex items-baseline justify-center gap-2 ${isProfit ? "text-stock-up" : "text-stock-down"}`}>
          <span className="font-mono text-5xl font-bold tracking-tight md:text-6xl">
            {isProfit ? "+" : ""}
            {profit.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className={`mt-2 flex items-center justify-center gap-2 ${isProfit ? "text-stock-up" : "text-stock-down"}`}>
          {isProfit ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          <span className="font-mono text-xl font-medium">
            {isProfit ? "+" : ""}{profitPercent.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* 持仓详情 */}
      <div className="mt-6 grid w-full max-w-sm grid-cols-3 gap-4 rounded-xl bg-secondary/30 p-4">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">持仓成本</p>
          <p className="mt-1 font-mono text-sm font-medium text-foreground">
            ¥{totalCost.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">当前市值</p>
          <p className="mt-1 font-mono text-sm font-medium text-foreground">
            ¥{currentValue.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">{isFund ? "持有份额" : "持股数量"}</p>
          <p className="mt-1 font-mono text-sm font-medium text-foreground">
            {sharesNum.toLocaleString()}{isFund ? "份" : "股"}
          </p>
        </div>
      </div>

      {/* 资产信息 + 编辑按钮 */}
      <div className="mt-6 flex w-full max-w-sm items-center justify-between border-t border-border/30 pt-4">
        <div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-foreground">{stockName}</span>
            <span className="text-muted-foreground/70">{stockSymbol}</span>
            {isFund && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">基金</span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-lg font-medium text-foreground">
              ¥{currentPrice.toFixed(isFund ? 4 : 2)}
            </span>
            <span className={`text-xs ${isStockUp ? "text-stock-up" : "text-stock-down"}`}>
              {isStockUp ? "+" : ""}{change.toFixed(isFund ? 4 : 2)} ({isStockUp ? "+" : ""}{changePercent.toFixed(2)}%)
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onEditClick}
          className="text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Settings2 className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}
