import { NextRequest, NextResponse } from "next/server";
import { getAllPositions, upsertPosition, deletePosition, touchPosition, updateCachedPrice, getAllPositionsWithPrices, savePortfolioCache } from "@/lib/db";
import { fetchStockQuote } from "@/lib/services/sina-stock";
import { fetchFundData } from "@/lib/services/eastmoney-fund";

// 判断是否为基金代码（6位纯数字）
function isFundCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

// 获取资产价格
async function fetchAssetPrice(code: string): Promise<number | null> {
  try {
    if (isFundCode(code)) {
      const fundData = await fetchFundData(code);
      return fundData.quote?.netWorth ?? null;
    } else {
      const quote = await fetchStockQuote(code);
      return quote.currentPrice;
    }
  } catch (error) {
    console.error(`获取 ${code} 价格失败:`, error);
    return null;
  }
}

// 预计算并缓存持仓数据
async function updatePortfolioCache(): Promise<void> {
  const positionsWithPrices = await getAllPositionsWithPrices();

  const items = positionsWithPrices.map((position) => {
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

  // 计算汇总数据
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

  if (summary.totalCost > 0) {
    summary.totalProfitPercent = (summary.totalProfit / summary.totalCost) * 100;
  }

  const hasPrices = items.some(item => item.currentPrice !== null);

  await savePortfolioCache({
    items,
    summary,
    hasPrices,
  });
}

// 获取所有持仓
export async function GET() {
  try {
    const positions = await getAllPositions();
    return NextResponse.json({ success: true, data: positions });
  } catch (error) {
    console.error("获取持仓失败:", error);
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json(
      { success: false, error: "获取持仓失败", detail: errorMessage },
      { status: 500 }
    );
  }
}

// 创建或更新持仓（upsert）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stockCode, stockName, costPrice, shares } = body;

    if (!stockCode || !stockName) {
      return NextResponse.json(
        { success: false, error: "缺少必要参数" },
        { status: 400 }
      );
    }

    const position = await upsertPosition({
      stockCode,
      stockName,
      costPrice,
      shares,
    });

    // 保存后自动获取价格并更新缓存（异步执行，不阻塞响应）
    (async () => {
      try {
        const price = await fetchAssetPrice(stockCode);
        if (price !== null) {
          await updateCachedPrice(stockCode, price);
        }
        // 更新持仓缓存
        await updatePortfolioCache();
      } catch (error) {
        console.error("自动更新价格缓存失败:", error);
      }
    })();

    return NextResponse.json({ success: true, data: position });
  } catch (error) {
    console.error("保存持仓失败:", error);
    return NextResponse.json(
      { success: false, error: "保存持仓失败" },
      { status: 500 }
    );
  }
}

// 删除持仓
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const stockCode = searchParams.get("stockCode");

    if (!stockCode) {
      return NextResponse.json(
        { success: false, error: "缺少股票代码参数" },
        { status: 400 }
      );
    }

    await deletePosition(stockCode);

    // 删除后更新持仓缓存（异步执行）
    (async () => {
      try {
        await updatePortfolioCache();
      } catch (error) {
        console.error("更新持仓缓存失败:", error);
      }
    })();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除持仓失败:", error);
    return NextResponse.json(
      { success: false, error: "删除持仓失败" },
      { status: 500 }
    );
  }
}

// 更新持仓访问时间（标记为最近查看）
export async function PATCH(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const stockCode = searchParams.get("stockCode");

    if (!stockCode) {
      return NextResponse.json(
        { success: false, error: "缺少股票代码参数" },
        { status: 400 }
      );
    }

    await touchPosition(stockCode);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("更新访问时间失败:", error);
    return NextResponse.json(
      { success: false, error: "更新访问时间失败" },
      { status: 500 }
    );
  }
}
