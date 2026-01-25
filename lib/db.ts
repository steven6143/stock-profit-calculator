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

  // 价格缓存表
  await client.execute(`
    CREATE TABLE IF NOT EXISTS price_cache (
      code TEXT PRIMARY KEY,
      price REAL NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 持仓汇总缓存表（预计算的数据，供快速读取）
  await client.execute(`
    CREATE TABLE IF NOT EXISTS portfolio_cache (
      id TEXT PRIMARY KEY DEFAULT 'main',
      data TEXT NOT NULL,
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

// 更新持仓的访问时间（用于记录最近查看的股票）
export async function touchPosition(stockCode: string): Promise<void> {
  const client = getDb();
  await initDb();

  const now = new Date().toISOString();
  await client.execute({
    sql: "UPDATE positions SET updatedAt = ? WHERE stockCode = ?",
    args: [now, stockCode],
  });
}

// 更新持仓的股票名称
export async function updatePositionName(stockCode: string, stockName: string): Promise<void> {
  const client = getDb();
  await initDb();

  await client.execute({
    sql: "UPDATE positions SET stockName = ? WHERE stockCode = ?",
    args: [stockName, stockCode],
  });
}

// ============ 价格缓存相关 ============

export interface CachedPrice {
  code: string;
  price: number;
  updatedAt: string;
}

// 获取缓存的价格
export async function getCachedPriceFromDb(code: string): Promise<CachedPrice | null> {
  const client = getDb();
  await initDb();

  const result = await client.execute({
    sql: "SELECT * FROM price_cache WHERE code = ?",
    args: [code],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    code: row.code as string,
    price: row.price as number,
    updatedAt: row.updatedAt as string,
  };
}

// 批量获取缓存的价格
export async function getBatchCachedPricesFromDb(codes: string[]): Promise<Map<string, CachedPrice>> {
  const client = getDb();
  await initDb();

  if (codes.length === 0) return new Map();

  const placeholders = codes.map(() => "?").join(",");
  const result = await client.execute({
    sql: `SELECT * FROM price_cache WHERE code IN (${placeholders})`,
    args: codes,
  });

  const priceMap = new Map<string, CachedPrice>();
  for (const row of result.rows) {
    priceMap.set(row.code as string, {
      code: row.code as string,
      price: row.price as number,
      updatedAt: row.updatedAt as string,
    });
  }

  return priceMap;
}

// 更新单个价格缓存
export async function updateCachedPrice(code: string, price: number): Promise<void> {
  const client = getDb();
  await initDb();

  const now = new Date().toISOString();
  await client.execute({
    sql: `
      INSERT INTO price_cache (code, price, updatedAt)
      VALUES (?, ?, ?)
      ON CONFLICT(code) DO UPDATE SET
        price = excluded.price,
        updatedAt = excluded.updatedAt
    `,
    args: [code, price, now],
  });
}

// 批量更新价格缓存
export async function updateBatchCachedPrices(prices: Map<string, number>): Promise<void> {
  const client = getDb();
  await initDb();

  const now = new Date().toISOString();

  // 逐个更新（避免 batch 的类型问题）
  for (const [code, price] of prices.entries()) {
    await client.execute({
      sql: `
        INSERT INTO price_cache (code, price, updatedAt)
        VALUES (?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET
          price = excluded.price,
          updatedAt = excluded.updatedAt
      `,
      args: [code, price, now],
    });
  }
}

// 获取所有持仓的代码
export async function getAllPositionCodes(): Promise<string[]> {
  const client = getDb();
  await initDb();

  const result = await client.execute("SELECT stockCode FROM positions");
  return result.rows.map((row) => row.stockCode as string);
}

// 一次性获取所有持仓及其缓存价格（优化版，单次查询）
export interface PositionWithPrice {
  id: string;
  stockCode: string;
  stockName: string;
  costPrice: number;
  shares: number;
  cachedPrice: number | null;
}

export async function getAllPositionsWithPrices(): Promise<PositionWithPrice[]> {
  const client = getDb();
  await initDb();

  const result = await client.execute(`
    SELECT
      p.id,
      p.stockCode,
      p.stockName,
      p.costPrice,
      p.shares,
      c.price as cachedPrice
    FROM positions p
    LEFT JOIN price_cache c ON p.stockCode = c.code
  `);

  return result.rows.map((row) => ({
    id: row.id as string,
    stockCode: row.stockCode as string,
    stockName: row.stockName as string,
    costPrice: row.costPrice as number,
    shares: row.shares as number,
    cachedPrice: row.cachedPrice as number | null,
  }));
}

// 保存预计算的持仓数据
export async function savePortfolioCache(data: unknown): Promise<void> {
  const client = getDb();
  await initDb();

  const now = new Date().toISOString();
  const jsonData = JSON.stringify(data);

  await client.execute({
    sql: `
      INSERT INTO portfolio_cache (id, data, updatedAt)
      VALUES ('main', ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        updatedAt = excluded.updatedAt
    `,
    args: [jsonData, now],
  });
}

// 读取预计算的持仓数据
export async function getPortfolioCache(): Promise<{ data: unknown; updatedAt: string } | null> {
  const client = getDb();
  await initDb();

  const result = await client.execute("SELECT data, updatedAt FROM portfolio_cache WHERE id = 'main'");

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    data: JSON.parse(row.data as string),
    updatedAt: row.updatedAt as string,
  };
}
