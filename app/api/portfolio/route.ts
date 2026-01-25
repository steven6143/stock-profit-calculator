import { NextResponse } from "next/server";
import { getAllPositions } from "@/lib/db";
import { fetchStockQuote } from "@/lib/services/sina-stock";
import { fetchFundData } from "@/lib/services/eastmoney-fund";
import { getCachedPrice, setCachedPrice } from "@/lib/services/price-cache";

// 判断是否为基金代码（6位纯数字）
function isFundCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

// 获取资产实时价格（带缓存）
async function getAssetPrice(code: string): Promise<number | null> {
  // 先检查缓存
  const cachedPrice = getCachedPrice(code);
  if (cachedPrice !== null) {
    return cachedPrice;
  }

  try {
    let price: number;
    if (isFundCode(code)) {
      // 基金
      const fundData = await fetchFundData(code);
      price = fundData.netWorth;
    } else {
      // 股票
      const quote = await fetchStockQuote(code);
      price = quote.currentPrice;
    }
    // 缓存价格
    setCachedPrice(code, price);
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

    if (quickMode) {
      // 快速模式：只返回静态数据，不请求实时价格
      // 但会尝试使用缓存的价格
      const items: PortfolioItem[] = positions.map((position) => {
        const cachedPrice = getCachedPrice(position.stockCode);
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

    // 完整模式：获取所有持仓的实时价格（带缓存）
    const items: PortfolioItem[] = await Promise.all(
      positions.map(async (position) => {
        const currentPrice = await getAssetPrice(position.stockCode);
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
