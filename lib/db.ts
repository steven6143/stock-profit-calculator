// Cloudflare D1 数据库客户端
import { getCloudflareContext } from "@opennextjs/cloudflare";

// 获取 D1 数据库实例
async function getDb() {
  const { env } = await getCloudflareContext();
  const db = (env as { DB?: D1Database }).DB;
  if (!db) {
    throw new Error("D1 database binding not found");
  }
  return db;
}

// 初始化标记
let initialized = false;

// 初始化数据库表
async function initDb() {
  if (initialized) return;

  const db = await getDb();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY,
      stockCode TEXT UNIQUE NOT NULL,
      stockName TEXT NOT NULL,
      costPrice REAL NOT NULL,
      shares REAL NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS price_cache (
      code TEXT PRIMARY KEY,
      price REAL NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS portfolio_cache (
      id TEXT PRIMARY KEY DEFAULT 'main',
      data TEXT NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  initialized = true;
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
  await initDb();
  const db = await getDb();
  const result = await db.prepare("SELECT * FROM positions ORDER BY updatedAt DESC").all();

  return (result.results || []).map((row) => ({
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
  await initDb();
  const db = await getDb();

  const now = new Date().toISOString();
  const id = generateId();

  // 先查询是否存在
  const existing = await db.prepare("SELECT id, createdAt FROM positions WHERE stockCode = ?")
    .bind(data.stockCode)
    .first();

  if (existing) {
    // 更新现有记录
    await db.prepare(
      `UPDATE positions SET stockName = ?, costPrice = ?, shares = ?, updatedAt = ? WHERE stockCode = ?`
    ).bind(data.stockName, data.costPrice, data.shares, now, data.stockCode).run();
  } else {
    // 插入新记录
    await db.prepare(
      `INSERT INTO positions (id, stockCode, stockName, costPrice, shares, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, data.stockCode, data.stockName, data.costPrice, data.shares, now, now).run();
  }

  const result = await db.prepare("SELECT * FROM positions WHERE stockCode = ?")
    .bind(data.stockCode)
    .first();

  return {
    id: result!.id as string,
    stockCode: result!.stockCode as string,
    stockName: result!.stockName as string,
    costPrice: result!.costPrice as number,
    shares: result!.shares as number,
    createdAt: result!.createdAt as string,
    updatedAt: result!.updatedAt as string,
  };
}

// 删除持仓
export async function deletePosition(stockCode: string): Promise<void> {
  await initDb();
  const db = await getDb();
  await db.prepare("DELETE FROM positions WHERE stockCode = ?").bind(stockCode).run();
}

// 根据股票代码获取持仓
export async function getPositionByCode(stockCode: string): Promise<Position | null> {
  await initDb();
  const db = await getDb();
  const row = await db.prepare("SELECT * FROM positions WHERE stockCode = ?")
    .bind(stockCode)
    .first();

  if (!row) return null;

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

// 更新持仓的访问时间
export async function touchPosition(stockCode: string): Promise<void> {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();
  await db.prepare("UPDATE positions SET updatedAt = ? WHERE stockCode = ?")
    .bind(now, stockCode)
    .run();
}

// 更新持仓的股票名称
export async function updatePositionName(stockCode: string, stockName: string): Promise<void> {
  await initDb();
  const db = await getDb();
  await db.prepare("UPDATE positions SET stockName = ? WHERE stockCode = ?")
    .bind(stockName, stockCode)
    .run();
}

// ============ 价格缓存相关 ============

export interface CachedPrice {
  code: string;
  price: number;
  updatedAt: string;
}

// 获取缓存的价格
export async function getCachedPriceFromDb(code: string): Promise<CachedPrice | null> {
  await initDb();
  const db = await getDb();
  const row = await db.prepare("SELECT * FROM price_cache WHERE code = ?")
    .bind(code)
    .first();

  if (!row) return null;

  return {
    code: row.code as string,
    price: row.price as number,
    updatedAt: row.updatedAt as string,
  };
}

// 批量获取缓存的价格
export async function getBatchCachedPricesFromDb(codes: string[]): Promise<Map<string, CachedPrice>> {
  await initDb();
  const db = await getDb();

  if (codes.length === 0) return new Map();

  const placeholders = codes.map(() => "?").join(",");
  const result = await db.prepare(`SELECT * FROM price_cache WHERE code IN (${placeholders})`)
    .bind(...codes)
    .all();

  const priceMap = new Map<string, CachedPrice>();
  for (const row of result.results || []) {
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
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();

  const existing = await db.prepare("SELECT code FROM price_cache WHERE code = ?")
    .bind(code)
    .first();

  if (existing) {
    await db.prepare("UPDATE price_cache SET price = ?, updatedAt = ? WHERE code = ?")
      .bind(price, now, code)
      .run();
  } else {
    await db.prepare("INSERT INTO price_cache (code, price, updatedAt) VALUES (?, ?, ?)")
      .bind(code, price, now)
      .run();
  }
}

// 批量更新价格缓存
export async function updateBatchCachedPrices(prices: Map<string, number>): Promise<void> {
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();

  for (const [code, price] of prices.entries()) {
    const existing = await db.prepare("SELECT code FROM price_cache WHERE code = ?")
      .bind(code)
      .first();

    if (existing) {
      await db.prepare("UPDATE price_cache SET price = ?, updatedAt = ? WHERE code = ?")
        .bind(price, now, code)
        .run();
    } else {
      await db.prepare("INSERT INTO price_cache (code, price, updatedAt) VALUES (?, ?, ?)")
        .bind(code, price, now)
        .run();
    }
  }
}

// 获取所有持仓的代码
export async function getAllPositionCodes(): Promise<string[]> {
  await initDb();
  const db = await getDb();
  const result = await db.prepare("SELECT stockCode FROM positions").all();
  return (result.results || []).map((row) => row.stockCode as string);
}

// 一次性获取所有持仓及其缓存价格
export interface PositionWithPrice {
  id: string;
  stockCode: string;
  stockName: string;
  costPrice: number;
  shares: number;
  cachedPrice: number | null;
}

export async function getAllPositionsWithPrices(): Promise<PositionWithPrice[]> {
  await initDb();
  const db = await getDb();
  const result = await db.prepare(`
    SELECT
      p.id,
      p.stockCode,
      p.stockName,
      p.costPrice,
      p.shares,
      c.price as cachedPrice
    FROM positions p
    LEFT JOIN price_cache c ON p.stockCode = c.code
  `).all();

  return (result.results || []).map((row) => ({
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
  await initDb();
  const db = await getDb();
  const now = new Date().toISOString();
  const jsonData = JSON.stringify(data);

  const existing = await db.prepare("SELECT id FROM portfolio_cache WHERE id = 'main'").first();

  if (existing) {
    await db.prepare("UPDATE portfolio_cache SET data = ?, updatedAt = ? WHERE id = 'main'")
      .bind(jsonData, now)
      .run();
  } else {
    await db.prepare("INSERT INTO portfolio_cache (id, data, updatedAt) VALUES ('main', ?, ?)")
      .bind(jsonData, now)
      .run();
  }
}

// 读取预计算的持仓数据
export async function getPortfolioCache(): Promise<{ data: unknown; updatedAt: string } | null> {
  await initDb();
  const db = await getDb();
  const row = await db.prepare("SELECT data, updatedAt FROM portfolio_cache WHERE id = 'main'").first();

  if (!row) {
    return null;
  }

  return {
    data: JSON.parse(row.data as string),
    updatedAt: row.updatedAt as string,
  };
}
