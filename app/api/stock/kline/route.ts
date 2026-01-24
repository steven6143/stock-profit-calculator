import { NextRequest, NextResponse } from "next/server";
import { fetchKLineData, getKLineParams } from "@/lib/services/sina-stock";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const range = searchParams.get("range") || "1D";

  if (!code) {
    return NextResponse.json(
      { success: false, error: "缺少股票代码参数" },
      { status: 400 }
    );
  }

  const { scale, datalen } = getKLineParams(range);
  const data = await fetchKLineData(code, scale, datalen);

  if (!data || data.length === 0) {
    return NextResponse.json(
      { success: false, error: "获取K线数据失败" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data });
}
