import { NextResponse } from "next/server";
import { getAllPositionCodes, updateBatchCachedPrices } from "@/lib/db";
import { fetchStockQuote } from "@/lib/services/sina-stock";
import { fetchFundData } from "@/lib/services/eastmoney-fund";

// 判断是否为基金代码（6位纯数字）
function isFundCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

// 判断当前是否在股票交易时间（北京时间 9:30-11:30, 13:00-15:00）
function isStockTradingTime(): boolean {
  const now = new Date();
  // 转换为北京时间
  const beijingTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
  const hours = beijingTime.getHours();
  const minutes = beijingTime.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  // 9:30-11:30 = 570-690 分钟
  // 13:00-15:00 = 780-900 分钟
  const isMorningSession = totalMinutes >= 570 && totalMinutes <= 690;
  const isAfternoonSession = totalMinutes >= 780 && totalMinutes <= 900;

  // 周末不交易
  const dayOfWeek = beijingTime.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  return !isWeekend && (isMorningSession || isAfternoonSession);
}

// 判断是否应该更新基金价格（每天晚上 20:00-23:00）
function shouldUpdateFundPrice(): boolean {
  const now = new Date();
  const beijingTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
  const hours = beijingTime.getHours();

  return hours >= 20 && hours <= 23;
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

// Cron API: 更新所有持仓的价格
// 可通过外部 cron 服务（如 cron-job.org）定时调用
// 也可配置 Vercel Cron（需要 Pro 计划才能高频调用）
export async function GET(request: Request) {
  const debugInfo: string[] = [];

  try {
    debugInfo.push("开始执行");

    // 验证 cron secret（可选，防止未授权调用）
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const forceUpdate = searchParams.get("force") === "true";
    const typeFilter = searchParams.get("type"); // "stock" | "fund" | null (all)

    debugInfo.push("获取持仓代码");

    // 获取所有持仓代码
    const allCodes = await getAllPositionCodes();
    debugInfo.push(`持仓代码: ${JSON.stringify(allCodes)}`);

    if (allCodes.length === 0) {
      return NextResponse.json({
        success: true,
        message: "没有持仓需要更新",
        updated: 0,
      });
    }

    // 根据类型和时间过滤需要更新的代码
    const codesToUpdate: string[] = [];
    const isTrading = isStockTradingTime();
    const shouldUpdateFund = shouldUpdateFundPrice();

    for (const code of allCodes) {
      const isFund = isFundCode(code);

      if (typeFilter === "stock" && isFund) continue;
      if (typeFilter === "fund" && !isFund) continue;

      if (forceUpdate) {
        codesToUpdate.push(code);
      } else if (isFund && shouldUpdateFund) {
        codesToUpdate.push(code);
      } else if (!isFund && isTrading) {
        codesToUpdate.push(code);
      }
    }

    debugInfo.push(`需要更新: ${JSON.stringify(codesToUpdate)}`);

    if (codesToUpdate.length === 0) {
      return NextResponse.json({
        success: true,
        message: "当前时间无需更新价格",
        isStockTradingTime: isTrading,
        shouldUpdateFund: shouldUpdateFund,
        updated: 0,
      });
    }

    debugInfo.push("开始获取价格");

    // 并行获取所有价格
    const priceResults = await Promise.all(
      codesToUpdate.map(async (code) => {
        const price = await fetchAssetPrice(code);
        return { code, price };
      })
    );

    debugInfo.push(`价格结果: ${JSON.stringify(priceResults)}`);

    // 过滤成功获取的价格
    const validPrices = new Map<string, number>();
    for (const { code, price } of priceResults) {
      if (price !== null && typeof price === 'number') {
        validPrices.set(code, price);
      }
    }

    debugInfo.push(`有效价格数量: ${validPrices.size}`);

    // 批量更新数据库
    if (validPrices.size > 0) {
      debugInfo.push("开始更新数据库");
      await updateBatchCachedPrices(validPrices);
      debugInfo.push("数据库更新完成");
    }

    return NextResponse.json({
      success: true,
      message: `成功更新 ${validPrices.size} 个价格`,
      updated: validPrices.size,
      failed: codesToUpdate.length - validPrices.size,
      isStockTradingTime: isTrading,
      shouldUpdateFund: shouldUpdateFund,
    });
  } catch (error) {
    console.error("更新价格失败:", error);
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json(
      { success: false, error: "更新价格失败", detail: errorMessage, debug: debugInfo },
      { status: 500 }
    );
  }
}
