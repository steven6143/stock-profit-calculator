"use client";

import { useState, useEffect } from "react";
import { StockChart } from "@/components/stock-chart";
import { StockStats } from "@/components/stock-stats";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { ProfitHero } from "@/components/profit-hero";
import { PositionDialog } from "@/components/position-dialog";
import { StockSearch } from "@/components/stock-search";
import { useStockQuote, useKLineData, usePosition } from "@/hooks/use-stock";
import type { StockSearchResult } from "@/lib/types/stock";
import { Loader2, TrendingUp } from "lucide-react";

export default function StockTrackerPage() {
  const [timeRange, setTimeRange] = useState("1D");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<{
    code: string;
    name: string;
  } | null>(null);

  const { quote, loading: quoteLoading } = useStockQuote(
    selectedStock?.code || null
  );
  const { chartData, loading: chartLoading } = useKLineData(
    selectedStock?.code || null,
    timeRange
  );
  const {
    positions,
    initialized,
    savePosition,
    deletePosition,
    getPositionByCode,
    touchPosition,
  } = usePosition();

  // 获取当前股票的持仓信息
  const currentPosition = selectedStock
    ? getPositionByCode(selectedStock.code)
    : null;

  // 页面加载时，如果有持仓记录，默认选择第一个
  useEffect(() => {
    if (initialized && !selectedStock && positions.length > 0) {
      const firstPosition = positions[0];
      setSelectedStock({
        code: firstPosition.stockCode,
        name: firstPosition.stockName,
      });
    }
  }, [positions, selectedStock, initialized]);

  const handleStockSelect = (stock: StockSearchResult) => {
    setSelectedStock({
      code: stock.code,
      name: stock.name,
    });
    // 如果选择的是已有持仓的股票，更新访问时间
    const existingPosition = positions.find((p) => p.stockCode === stock.code);
    if (existingPosition) {
      touchPosition(stock.code);
    }
  };

  const handleSavePosition = async (costPrice: string, shares: string) => {
    if (!selectedStock) return;

    const cost = parseFloat(costPrice);
    const sharesNum = parseInt(shares);

    if (cost > 0 && sharesNum > 0) {
      await savePosition({
        stockCode: selectedStock.code,
        stockName: selectedStock.name,
        costPrice: cost,
        shares: sharesNum,
      });
      // 保存后滚动到页面顶部
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleClearPosition = async () => {
    if (selectedStock) {
      await deletePosition(selectedStock.code);
      // 清除后滚动到页面顶部
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const isUp = quote ? quote.change >= 0 : true;
  const costPriceNum = currentPosition?.costPrice;

  // 计算市值（简化处理）
  const marketCap = quote
    ? quote.amount > 100000000
      ? `${(quote.amount / 100000000).toFixed(2)}亿`
      : `${(quote.amount / 10000).toFixed(2)}万`
    : "-";

  // 判断是否需要显示加载动画
  // 1. 持仓数据未初始化
  // 2. 有持仓记录但还没选择股票（等待自动选择）
  // 3. 已选择股票但数据还在加载
  const isInitialLoading = !initialized ||
    (initialized && positions.length > 0 && !selectedStock) ||
    (initialized && positions.length > 0 && selectedStock && !quote);

  // 初始加载动画
  if (isInitialLoading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="flex min-h-screen flex-col items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <TrendingUp className="h-12 w-12 text-primary animate-pulse" />
            </div>
            <div className="flex items-center space-x-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">加载中...</span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
        {/* 股票搜索 */}
        <section className="mb-6">
          <StockSearch onSelect={handleStockSelect} />
        </section>

        {/* 加载状态 */}
        {quoteLoading && !quote && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* 未选择股票时的提示 */}
        {!selectedStock && !quoteLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-lg text-muted-foreground">搜索并选择一只股票</p>
            <p className="mt-2 text-sm text-muted-foreground/70">
              输入股票代码或名称开始追踪
            </p>
          </div>
        )}

        {/* 股票信息展示 */}
        {selectedStock && quote && (
          <>
            {/* Profit Hero - 核心盈亏信息 */}
            <section className="mb-8">
              <ProfitHero
                currentPrice={quote.currentPrice}
                costPrice={currentPosition?.costPrice?.toString() || ""}
                shares={currentPosition?.shares?.toString() || ""}
                stockName={quote.name}
                stockSymbol={selectedStock.code}
                change={quote.change}
                changePercent={quote.changePercent}
                onEditClick={() => setDialogOpen(true)}
              />
            </section>

            {/* 次要信息: 图表和统计 */}
            <section className="space-y-4 opacity-80">
              {/* Time Range Selector */}
              <TimeRangeSelector selected={timeRange} onSelect={setTimeRange} />

              {/* Stock Chart */}
              {chartLoading ? (
                <div className="flex h-[300px] items-center justify-center md:h-[400px]">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : chartData.length > 0 ? (
                <StockChart
                  data={chartData}
                  isUp={isUp}
                  costPrice={costPriceNum}
                  timeRange={timeRange}
                />
              ) : (
                <div className="flex h-[300px] items-center justify-center text-muted-foreground md:h-[400px]">
                  暂无图表数据
                </div>
              )}

              {/* Stock Stats */}
              <StockStats
                open={quote.open}
                high={quote.high}
                low={quote.low}
                volume={quote.volume}
                marketCap={marketCap}
              />
            </section>
          </>
        )}

        {/* Position Dialog */}
        <PositionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          costPrice={currentPosition?.costPrice?.toString() || ""}
          shares={currentPosition?.shares?.toString() || ""}
          onSave={handleSavePosition}
          onClear={handleClearPosition}
          hasPosition={!!currentPosition}
        />
      </div>
    </main>
  );
}
