"use client";

import { useState, useEffect, useCallback } from "react";
import { StockChart } from "@/components/stock-chart";
import { StockStats } from "@/components/stock-stats";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { ProfitHero } from "@/components/profit-hero";
import { PositionDialog } from "@/components/position-dialog";
import { PortfolioDialog } from "@/components/portfolio-dialog";
import { StockSearch } from "@/components/stock-search";
import { useStockQuote, useKLineData, usePosition, useFundData } from "@/hooks/use-stock";
import type { AssetType } from "@/lib/types/stock";
import type { UnifiedSearchResult } from "@/hooks/use-stock";
import { Loader2, TrendingUp, ChevronUp, Wallet, RefreshCw } from "lucide-react";

// Portfolio 数据类型
interface PortfolioItem {
  id: string;
  code: string;
  name: string;
  assetType: "stock" | "fund";
  costPrice: number;
  shares: number;
  currentPrice: number | null;
  totalCost: number;
  marketValue: number | null;
  profit: number | null;
  profitPercent: number | null;
}

interface PortfolioSummary {
  totalCost: number;
  totalMarketValue: number;
  totalProfit: number;
  totalProfitPercent: number;
}

interface PortfolioData {
  items: PortfolioItem[];
  summary: PortfolioSummary;
}

export default function StockTrackerPage() {
  const [timeRange, setTimeRange] = useState("1D");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<{
    code: string;
    name: string;
    type: AssetType;
  } | null>(null);

  // Portfolio 预加载状态
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  // 监听滚动，显示/隐藏回到顶部按钮
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 获取 Portfolio 数据 - 直接从数据库获取，速度快
  const fetchPortfolio = useCallback(async () => {
    setPortfolioLoading(true);
    try {
      const response = await fetch("/api/portfolio");
      const result = await response.json();
      if (result.success && result.data) {
        setPortfolioData(result.data);
      }
    } catch (error) {
      console.error("获取投资组合失败:", error);
    } finally {
      setPortfolioLoading(false);
    }
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 强制刷新所有持仓价格
  const handleForceRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/cron/update-prices?force=true");
      // 刷新完成后重新获取 Portfolio 数据
      await fetchPortfolio();
    } catch (error) {
      console.error("强制刷新失败:", error);
    } finally {
      setRefreshing(false);
    }
  };

  // 股票数据
  const { quote: stockQuote, loading: stockQuoteLoading } = useStockQuote(
    selectedAsset?.type === "stock" ? selectedAsset.code : null
  );
  const { chartData: stockChartData, loading: stockChartLoading } = useKLineData(
    selectedAsset?.type === "stock" ? selectedAsset.code : null,
    timeRange
  );

  // 基金数据
  const { quote: fundQuote, chartData: fundChartData, loading: fundLoading } = useFundData(
    selectedAsset?.type === "fund" ? selectedAsset.code : null,
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

  // 页面加载完成后预加载 Portfolio 数据
  useEffect(() => {
    if (initialized && positions.length > 0) {
      fetchPortfolio();
    }
  }, [initialized, positions.length]);

  // 根据资产类型获取当前数据
  const isStock = selectedAsset?.type === "stock";
  const currentPrice = isStock ? stockQuote?.currentPrice : fundQuote?.netWorth;
  const change = isStock ? stockQuote?.change : (fundQuote ? fundQuote.netWorth * fundQuote.dayGrowth / 100 : 0);
  const changePercent = isStock ? stockQuote?.changePercent : fundQuote?.dayGrowth;
  const chartData = isStock ? stockChartData : fundChartData;
  const quoteLoading = isStock ? stockQuoteLoading : fundLoading;
  const chartLoading = isStock ? stockChartLoading : fundLoading;
  const hasQuote = isStock ? !!stockQuote : !!fundQuote;

  // 获取当前资产的持仓信息
  const currentPosition = selectedAsset
    ? getPositionByCode(selectedAsset.code)
    : null;

  // 页面加载时，如果有持仓记录，默认选择第一个
  useEffect(() => {
    if (initialized && !selectedAsset && positions.length > 0) {
      const firstPosition = positions[0];
      // 根据代码格式判断类型：基金代码是纯数字6位
      const isFund = /^\d{6}$/.test(firstPosition.stockCode);
      setSelectedAsset({
        code: firstPosition.stockCode,
        name: firstPosition.stockName,
        type: isFund ? "fund" : "stock",
      });
      // 基金没有日线，默认使用1周
      if (isFund) {
        setTimeRange("1W");
      }
    }
  }, [positions, selectedAsset, initialized]);

  const handleAssetSelect = (result: UnifiedSearchResult) => {
    setSelectedAsset({
      code: result.code,
      name: result.name,
      type: result.type,
    });
    // 基金没有日线，切换到1周
    if (result.type === "fund" && timeRange === "1D") {
      setTimeRange("1W");
    }
    // 如果选择的是已有持仓的资产，更新访问时间
    const existingPosition = positions.find((p) => p.stockCode === result.code);
    if (existingPosition) {
      touchPosition(result.code);
    }
  };

  const handlePortfolioSelect = (code: string, name: string, assetType: AssetType) => {
    setSelectedAsset({
      code,
      name,
      type: assetType,
    });
    // 基金没有日线，切换到1周
    if (assetType === "fund" && timeRange === "1D") {
      setTimeRange("1W");
    }
    // 更新访问时间
    touchPosition(code);
  };

  const handleSavePosition = async (costPrice: string, shares: string) => {
    if (!selectedAsset) return;

    const cost = parseFloat(costPrice);
    const sharesNum = parseFloat(shares); // 使用 parseFloat 支持基金份额小数

    if (cost > 0 && sharesNum > 0) {
      await savePosition({
        stockCode: selectedAsset.code,
        stockName: selectedAsset.name,
        costPrice: cost,
        shares: sharesNum,
      });
      // 持仓变化后重新拉取 Portfolio 数据
      fetchPortfolio();
    }
  };

  const handleClearPosition = async () => {
    if (selectedAsset) {
      await deletePosition(selectedAsset.code);
      // 持仓变化后重新拉取 Portfolio 数据
      fetchPortfolio();
    }
  };

  const isUp = change !== undefined ? change >= 0 : true;
  const costPriceNum = currentPosition?.costPrice;

  // 计算市值（仅股票显示）
  const marketCap = isStock && stockQuote
    ? stockQuote.amount > 100000000
      ? `${(stockQuote.amount / 100000000).toFixed(2)}亿`
      : `${(stockQuote.amount / 10000).toFixed(2)}万`
    : "-";

  // 判断是否需要显示加载动画
  const isInitialLoading = !initialized ||
    (initialized && positions.length > 0 && !selectedAsset) ||
    (initialized && positions.length > 0 && selectedAsset && !hasQuote);

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
        {/* 搜索框 */}
        <section className="mb-6">
          <StockSearch onSelect={handleAssetSelect} />
        </section>

        {/* 加载状态 */}
        {quoteLoading && !hasQuote && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* 未选择资产时的提示 */}
        {!selectedAsset && !quoteLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-lg text-muted-foreground">搜索并选择股票或基金</p>
            <p className="mt-2 text-sm text-muted-foreground/70">
              输入代码或名称开始追踪
            </p>
          </div>
        )}

        {/* 资产信息展示 */}
        {selectedAsset && hasQuote && currentPrice !== undefined && (
          <>
            {/* Profit Hero - 核心盈亏信息 */}
            <section className="mb-8">
              <ProfitHero
                currentPrice={currentPrice}
                costPrice={currentPosition?.costPrice?.toString() || ""}
                shares={currentPosition?.shares?.toString() || ""}
                stockName={selectedAsset.name}
                stockSymbol={selectedAsset.code}
                change={change || 0}
                changePercent={changePercent || 0}
                onEditClick={() => setDialogOpen(true)}
                assetType={selectedAsset.type}
              />
            </section>

            {/* 次要信息: 图表和统计 */}
            <section className="space-y-4 opacity-80">
              {/* Time Range Selector */}
              <TimeRangeSelector selected={timeRange} onSelect={setTimeRange} isFund={!isStock} />

              {/* Chart */}
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

              {/* Stats - 仅股票显示详细统计 */}
              {isStock && stockQuote && (
                <StockStats
                  open={stockQuote.open}
                  high={stockQuote.high}
                  low={stockQuote.low}
                  volume={stockQuote.volume}
                  marketCap={marketCap}
                />
              )}

              {/* 基金显示简化信息 */}
              {!isStock && fundQuote && (
                <div className="grid grid-cols-2 gap-4 rounded-lg bg-card p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">单位净值</p>
                    <p className="text-lg font-semibold text-foreground">
                      {fundQuote.netWorth.toFixed(4)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">日涨跌幅</p>
                    <p className={`text-lg font-semibold ${fundQuote.dayGrowth >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {fundQuote.dayGrowth >= 0 ? "+" : ""}{fundQuote.dayGrowth.toFixed(2)}%
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">更新日期</p>
                    <p className="text-sm text-foreground">{fundQuote.lastUpdate}</p>
                  </div>
                </div>
              )}
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
          assetType={selectedAsset?.type || "stock"}
        />

        {/* Portfolio Dialog */}
        <PortfolioDialog
          open={portfolioOpen}
          onOpenChange={setPortfolioOpen}
          onSelectAsset={handlePortfolioSelect}
          preloadedData={portfolioData}
          preloadedLoading={portfolioLoading}
          onRefresh={fetchPortfolio}
        />
      </div>

      {/* 悬浮按钮组 */}
      <div className="fixed right-6 z-40 flex flex-col gap-3 transition-all duration-300" style={{ bottom: showScrollTop ? '5.5rem' : '1.5rem' }}>
        {/* 强制刷新按钮 */}
        <button
          onClick={handleForceRefresh}
          disabled={refreshing}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary border border-border text-muted-foreground shadow-lg transition-all hover:bg-secondary/80 hover:text-foreground active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="强制刷新"
        >
          <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>

        {/* 持仓按钮 - 始终显示 */}
        <button
          onClick={() => setPortfolioOpen(true)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary border border-border text-muted-foreground shadow-lg transition-all hover:bg-secondary/80 hover:text-foreground active:scale-95"
          aria-label="我的持仓"
        >
          <Wallet className="h-5 w-5" />
        </button>
      </div>

      {/* 回到顶部按钮 */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-secondary border border-border text-muted-foreground shadow-lg transition-all hover:bg-secondary/80 hover:text-foreground active:scale-95"
          aria-label="回到顶部"
        >
          <ChevronUp className="h-6 w-6" />
        </button>
      )}
    </main>
  );
}
