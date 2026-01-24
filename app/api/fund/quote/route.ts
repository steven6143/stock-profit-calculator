import { NextRequest, NextResponse } from "next/server";
import { fetchFundData, filterNetWorthByRange, toChartData } from "@/lib/services/eastmoney-fund";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const range = searchParams.get("range") || "1M";

  if (!code) {
    return NextResponse.json(
      { success: false, error: "缺少基金代码" },
      { status: 400 }
    );
  }

  const { quote, netWorthTrend } = await fetchFundData(code);

  if (!quote) {
    return NextResponse.json(
      { success: false, error: "获取基金数据失败" },
      { status: 404 }
    );
  }

  // 根据时间范围过滤数据
  const filteredData = filterNetWorthByRange(netWorthTrend, range);
  const chartData = toChartData(filteredData);

  return NextResponse.json({
    success: true,
    data: {
      quote,
      chartData,
    },
  });
}
