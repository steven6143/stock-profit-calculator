import { createClient, type Client } from "@libsql/client";

// 数据库客户端单例
let db: Client | null = null;

export function getDb(): Client {
  if (db) return db;

  const url = process.env.TURSO_DATABASE_URL || "file:./data/local.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;

  db = createClient({
    url,
    authToken,
  });

  return db;
}

// 初始化数据库表
export async function initDb() {
  const client = getDb();

  await client.execute(`
    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY,
      stockCode TEXT UNIQUE NOT NULL,
      stockName TEXT NOT NULL,
      costPrice REAL NOT NULL,
      shares INTEGER NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// 生成唯一 ID
function generateId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
}

// Position 类型
export interface Position {
  id: string;
  stockCode: string;
  stockName: string;
  costPrice: number;
  shares: number;
  createdAt: string;
  updatedAt: string;
}

// 获取所有持仓
export async function getAllPositions(): Promise<Position[]> {
  const client = getDb();
  await initDb();

  const result = await client.execute("SELECT * FROM positions ORDER BY updatedAt DESC");

  return result.rows.map((row) => ({
    id: row.id as string,
    stockCode: row.stockCode as string,
    stockName: row.stockName as string,
    costPrice: row.costPrice as number,
    shares: row.shares as number,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
  }));
}

// 创建或更新持仓
export async function upsertPosition(data: {
  stockCode: string;
  stockName: string;
  costPrice: number;
  shares: number;
}): Promise<Position> {
  const client = getDb();
  await initDb();

  const now = new Date().toISOString();
  const id = generateId();

  // 使用 INSERT OR REPLACE
  await client.execute({
    sql: `
      INSERT INTO positions (id, stockCode, stockName, costPrice, shares, createdAt, updatedAt)
      VALUES (
        COALESCE((SELECT id FROM positions WHERE stockCode = ?), ?),
        ?, ?, ?, ?,
        COALESCE((SELECT createdAt FROM positions WHERE stockCode = ?), ?),
        ?
      )
      ON CONFLICT(stockCode) DO UPDATE SET
        stockName = excluded.stockName,
        costPrice = excluded.costPrice,
        shares = excluded.shares,
        updatedAt = excluded.updatedAt
    `,
    args: [data.stockCode, id, data.stockCode, data.stockName, data.costPrice, data.shares, data.stockCode, now, now],
  });

  // 返回更新后的数据
  const result = await client.execute({
    sql: "SELECT * FROM positions WHERE stockCode = ?",
    args: [data.stockCode],
  });

  const row = result.rows[0];
  return {
    id: row.id as string,
    stockCode: row.stockCode as string,
    stockName: row.stockName as string,
    costPrice: row.costPrice as number,
    shares: row.shares as number,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
  };
}

// 删除持仓
export async function deletePosition(stockCode: string): Promise<void> {
  const client = getDb();
  await initDb();

  await client.execute({
    sql: "DELETE FROM positions WHERE stockCode = ?",
    args: [stockCode],
  });
}

// 根据股票代码获取持仓
export async function getPositionByCode(stockCode: string): Promise<Position | null> {
  const client = getDb();
  await initDb();

  const result = await client.execute({
    sql: "SELECT * FROM positions WHERE stockCode = ?",
    args: [stockCode],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id as string,
    stockCode: row.stockCode as string,
    stockName: row.stockName as string,
    costPrice: row.costPrice as number,
    shares: row.shares as number,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
  };
}
