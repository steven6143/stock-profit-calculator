import { NextResponse } from "next/server";
import { getAllPositions } from "@/lib/db";
import { fetchStockQuote } from "@/lib/services/sina-stock";
import { fetchFundData } from "@/lib/services/eastmoney-fund";

// 判断是否为基金代码（6位纯数字）
function isFundCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

// 获取资产实时价格
async function getAssetPrice(code: string): Promise<number | null> {
  try {
    if (isFundCode(code)) {
      // 基金
      const fundData = await fetchFundData(code);
      return fundData.netWorth;
    } else {
      // 股票
      const quote = await fetchStockQuote(code);
      return quote.currentPrice;
    }
  } catch (error) {
    console.error(`获取 ${code} 价格失败:`, error);
    return null;
  }
}

export interface PortfolioItem {
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

export interface PortfolioSummary {
  totalCost: number;
  totalMarketValue: number;
  totalProfit: number;
  totalProfitPercent: number;
}

export interface PortfolioResponse {
  items: PortfolioItem[];
  summary: PortfolioSummary;
}

// 获取投资组合（所有持仓及盈亏统计）
export async function GET() {
  try {
    const positions = await getAllPositions();

    // 获取所有持仓的实时价格
    const items: PortfolioItem[] = await Promise.all(
      positions.map(async (position) => {
        const currentPrice = await getAssetPrice(position.stockCode);
        const totalCost = position.costPrice * position.shares;
        const marketValue = currentPrice ? currentPrice * position.shares : null;
        const profit = marketValue !== null ? marketValue - totalCost : null;
        const profitPercent = profit !== null ? (profit / totalCost) * 100 : null;

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

    // 计算总计
    const summary: PortfolioSummary = items.reduce(
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

    const response: PortfolioResponse = {
      items,
      summary,
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
