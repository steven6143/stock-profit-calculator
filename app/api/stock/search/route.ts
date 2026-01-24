import { NextRequest, NextResponse } from "next/server";
import { searchStock } from "@/lib/services/sina-stock";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const keyword = searchParams.get("keyword");

  if (!keyword) {
    return NextResponse.json(
      { success: false, error: "缺少搜索关键词" },
      { status: 400 }
    );
  }

  const results = await searchStock(keyword);

  return NextResponse.json({ success: true, data: results });
}
