import { NextResponse } from "next/server";
import { getAllPositions, getBatchCachedPricesFromDb, updateCachedPrice } from "@/lib/db";
import { fetchStockQuote } from "@/lib/services/sina-stock";
import { fetchFundData } from "@/lib/services/eastmoney-fund";

// 判断是否为基金代码（6位纯数字）
function isFundCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

// 获取资产实时价格并更新数据库缓存
async function fetchAndCachePrice(code: string): Promise<number | null> {
  try {
    let price: number;
    if (isFundCode(code)) {
      const fundData = await fetchFundData(code);
      price = fundData.netWorth;
    } else {
      const quote = await fetchStockQuote(code);
      price = quote.currentPrice;
    }
    // 更新数据库缓存
    await updateCachedPrice(code, price);
    return price;
  } catch (error) {
    console.error(`获取 ${code} 价格失败:`, error);
    return null;
  }
}

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

interface PortfolioResponse {
  items: PortfolioItem[];
  summary: PortfolioSummary;
  hasPrices: boolean; // 标记是否包含实时价格
}

// 计算盈亏数据
function calculateProfitData(items: PortfolioItem[]): PortfolioSummary {
  const summary = items.reduce(
    (acc, item) => {
      acc.totalCost += item.totalCost;
      if (item.marketValue !== null) {
        acc.totalMarketValue += item.marketValue;
      }
      if (item.profit !== null) {
        acc.totalProfit += item.profit;
      }
      return acc;
    },
    {
      totalCost: 0,
      totalMarketValue: 0,
      totalProfit: 0,
      totalProfitPercent: 0,
    }
  );

  // 计算总盈亏比例
  if (summary.totalCost > 0) {
    summary.totalProfitPercent = (summary.totalProfit / summary.totalCost) * 100;
  }

  return summary;
}

// 获取投资组合
// 参数 quick=true 时只返回静态数据（不请求实时价格），用于快速显示
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const quickMode = searchParams.get("quick") === "true";

    const positions = await getAllPositions();
    const codes = positions.map((p) => p.stockCode);

    // 从数据库获取缓存的价格
    const cachedPrices = await getBatchCachedPricesFromDb(codes);

    if (quickMode) {
      // 快速模式：只返回静态数据 + 数据库缓存的价格
      const items: PortfolioItem[] = positions.map((position) => {
        const cached = cachedPrices.get(position.stockCode);
        const cachedPrice = cached?.price ?? null;
        const totalCost = position.costPrice * position.shares;
        const marketValue = cachedPrice ? cachedPrice * position.shares : null;
        const profit = marketValue !== null ? marketValue - totalCost : null;
        const profitPercent = profit !== null && totalCost > 0 ? (profit / totalCost) * 100 : null;

        return {
          id: position.id,
          code: position.stockCode,
          name: position.stockName,
          assetType: isFundCode(position.stockCode) ? "fund" : "stock",
          costPrice: position.costPrice,
          shares: position.shares,
          currentPrice: cachedPrice,
          totalCost,
          marketValue,
          profit,
          profitPercent,
        };
      });

      const summary = calculateProfitData(items);
      const hasPrices = items.some(item => item.currentPrice !== null);

      const response: PortfolioResponse = {
        items,
        summary,
        hasPrices,
      };

      return NextResponse.json({ success: true, data: response });
    }

    // 完整模式：获取所有持仓的实时价格
    const items: PortfolioItem[] = await Promise.all(
      positions.map(async (position) => {
        // 先尝试使用数据库缓存
        const cached = cachedPrices.get(position.stockCode);
        let currentPrice = cached?.price ?? null;

        // 如果没有缓存，则实时获取
        if (currentPrice === null) {
          currentPrice = await fetchAndCachePrice(position.stockCode);
        }

        const totalCost = position.costPrice * position.shares;
        const marketValue = currentPrice ? currentPrice * position.shares : null;
        const profit = marketValue !== null ? marketValue - totalCost : null;
        const profitPercent = profit !== null && totalCost > 0 ? (profit / totalCost) * 100 : null;

        return {
          id: position.id,
          code: position.stockCode,
          name: position.stockName,
          assetType: isFundCode(position.stockCode) ? "fund" : "stock",
          costPrice: position.costPrice,
          shares: position.shares,
          currentPrice,
          totalCost,
          marketValue,
          profit,
          profitPercent,
        };
      })
    );

    const summary = calculateProfitData(items);

    const response: PortfolioResponse = {
      items,
      summary,
      hasPrices: true,
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error("获取投资组合失败:", error);
    return NextResponse.json(
      { success: false, error: "获取投资组合失败" },
      { status: 500 }
    );
  }
}
