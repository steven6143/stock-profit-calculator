import { NextResponse } from "next/server";
import { getPortfolioCache } from "@/lib/db";

// 获取投资组合
// 直接从预计算缓存读取，速度极快
export async function GET() {
  try {
    // 从缓存读取预计算的数据
    const cache = await getPortfolioCache();

    if (cache) {
      return NextResponse.json({
        success: true,
        data: cache.data,
        cachedAt: cache.updatedAt,
      });
    }

    // 缓存为空，返回空数据
    return NextResponse.json({
      success: true,
      data: {
        items: [],
        summary: {
          totalCost: 0,
          totalMarketValue: 0,
          totalProfit: 0,
          totalProfitPercent: 0,
        },
        hasPrices: false,
      },
      cachedAt: null,
    });
  } catch (error) {
    console.error("获取投资组合失败:", error);
    return NextResponse.json(
      { success: false, error: "获取投资组合失败" },
      { status: 500 }
    );
  }
}
