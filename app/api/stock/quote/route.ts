import { NextRequest, NextResponse } from "next/server";
import { fetchStockQuote } from "@/lib/services/sina-stock";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      { success: false, error: "缺少股票代码参数" },
      { status: 400 }
    );
  }

  const quote = await fetchStockQuote(code);

  if (!quote) {
    return NextResponse.json(
      { success: false, error: "获取行情失败，请检查股票代码是否正确" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: quote });
}
