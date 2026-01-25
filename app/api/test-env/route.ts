import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hasDbUrl: !!process.env.TURSO_DATABASE_URL,
    hasAuthToken: !!process.env.TURSO_AUTH_TOKEN,
    dbUrlPrefix: process.env.TURSO_DATABASE_URL?.substring(0, 20),
  });
}
