import { NextRequest, NextResponse } from "next/server";
import { getAllPositions, upsertPosition, deletePosition } from "@/lib/db";

// 获取所有持仓
export async function GET() {
  try {
    const positions = await getAllPositions();
    return NextResponse.json({ success: true, data: positions });
  } catch (error) {
    console.error("获取持仓失败:", error);
    return NextResponse.json(
      { success: false, error: "获取持仓失败" },
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("删除持仓失败:", error);
    return NextResponse.json(
      { success: false, error: "删除持仓失败" },
      { status: 500 }
    );
  }
}
