import { NextResponse } from "next/server";
import { getAllPositionsWithPrices } from "@/lib/db";

// 判断是否为基金代码（6位纯数字）
function isFundCode(code: string): boolean {
  return /^\d{6}$/.test(code);
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
// 使用单次 JOIN 查询获取所有数据，速度最快
export async function GET() {
  try {
    // 单次查询获取持仓和缓存价格
    const positionsWithPrices = await getAllPositionsWithPrices();

    // 直接计算
    const items: PortfolioItem[] = positionsWithPrices.map((position) => {
      const currentPrice = position.cachedPrice;
      const totalCost = position.costPrice * position.shares;
      const marketValue = currentPrice !== null ? currentPrice * position.shares : null;
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
    });

    const summary = calculateProfitData(items);
    const hasPrices = items.some(item => item.currentPrice !== null);

    const response: PortfolioResponse = {
      items,
      summary,
      hasPrices,
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
