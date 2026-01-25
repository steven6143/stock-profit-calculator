// Turso HTTP API 客户端 - 兼容 Cloudflare Workers

interface TursoResponse {
  results: Array<{
    columns: string[];
    rows: Array<Array<string | number | null>>;
  }>;
}

// 执行 SQL 查询
async function executeSQL(sql: string, args: (string | number | null)[] = []): Promise<{ columns: string[]; rows: Array<Record<string, unknown>> }> {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
  }

  // 将 libsql:// 转换为 https://
  const httpUrl = url.replace("libsql://", "https://");

  const response = await fetch(httpUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      statements: [
        {
          q: sql,
          params: args.map(arg => {
            if (arg === null) return { type: "null", value: null };
            if (typeof arg === "number") return { type: "float", value: String(arg) };
            return { type: "text", value: String(arg) };
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Turso API error: ${response.status} - ${text}`);
  }

  const data = await response.json() as TursoResponse;

  if (!data.results || data.results.length === 0) {
    return { columns: [], rows: [] };
  }

  const result = data.results[0];
  const columns = result.columns || [];
  const rows = (result.rows || []).map(row => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });

  return { columns, rows };
}

// 初始化标记
let initialized = false;

// 初始化数据库表
async function initDb() {
  if (initialized) return;

  await executeSQL(`
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

  await executeSQL(`
    CREATE TABLE IF NOT EXISTS price_cache (
      code TEXT PRIMARY KEY,
      price REAL NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await executeSQL(`
    CREATE TABLE IF NOT EXISTS portfolio_cache (
      id TEXT PRIMARY KEY DEFAULT 'main',
      data TEXT NOT NULL,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

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
  const result = await executeSQL("SELECT * FROM positions ORDER BY updatedAt DESC");

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
  await initDb();

  const now = new Date().toISOString();
  const id = generateId();

  await executeSQL(
    `INSERT INTO positions (id, stockCode, stockName, costPrice, shares, createdAt, updatedAt)
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
       updatedAt = excluded.updatedAt`,
    [data.stockCode, id, data.stockCode, data.stockName, data.costPrice, data.shares, data.stockCode, now, now]
  );

  const result = await executeSQL("SELECT * FROM positions WHERE stockCode = ?", [data.stockCode]);

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
  await initDb();
  await executeSQL("DELETE FROM positions WHERE stockCode = ?", [stockCode]);
}

// 根据股票代码获取持仓
export async function getPositionByCode(stockCode: string): Promise<Position | null> {
  await initDb();
  const result = await executeSQL("SELECT * FROM positions WHERE stockCode = ?", [stockCode]);

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

// 更新持仓的访问时间
export async function touchPosition(stockCode: string): Promise<void> {
  await initDb();
  const now = new Date().toISOString();
  await executeSQL("UPDATE positions SET updatedAt = ? WHERE stockCode = ?", [now, stockCode]);
}

// 更新持仓的股票名称
export async function updatePositionName(stockCode: string, stockName: string): Promise<void> {
  await initDb();
  await executeSQL("UPDATE positions SET stockName = ? WHERE stockCode = ?", [stockName, stockCode]);
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
  const result = await executeSQL("SELECT * FROM price_cache WHERE code = ?", [code]);

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
  await initDb();

  if (codes.length === 0) return new Map();

  const placeholders = codes.map(() => "?").join(",");
  const result = await executeSQL(`SELECT * FROM price_cache WHERE code IN (${placeholders})`, codes);

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
  await initDb();
  const now = new Date().toISOString();
  await executeSQL(
    `INSERT INTO price_cache (code, price, updatedAt)
     VALUES (?, ?, ?)
     ON CONFLICT(code) DO UPDATE SET
       price = excluded.price,
       updatedAt = excluded.updatedAt`,
    [code, price, now]
  );
}

// 批量更新价格缓存
export async function updateBatchCachedPrices(prices: Map<string, number>): Promise<void> {
  await initDb();
  const now = new Date().toISOString();

  for (const [code, price] of prices.entries()) {
    await executeSQL(
      `INSERT INTO price_cache (code, price, updatedAt)
       VALUES (?, ?, ?)
       ON CONFLICT(code) DO UPDATE SET
         price = excluded.price,
         updatedAt = excluded.updatedAt`,
      [code, price, now]
    );
  }
}

// 获取所有持仓的代码
export async function getAllPositionCodes(): Promise<string[]> {
  await initDb();
  const result = await executeSQL("SELECT stockCode FROM positions");
  return result.rows.map((row) => row.stockCode as string);
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
  const result = await executeSQL(`
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
  await initDb();
  const now = new Date().toISOString();
  const jsonData = JSON.stringify(data);

  await executeSQL(
    `INSERT INTO portfolio_cache (id, data, updatedAt)
     VALUES ('main', ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       data = excluded.data,
       updatedAt = excluded.updatedAt`,
    [jsonData, now]
  );
}

// 读取预计算的持仓数据
export async function getPortfolioCache(): Promise<{ data: unknown; updatedAt: string } | null> {
  await initDb();
  const result = await executeSQL("SELECT data, updatedAt FROM portfolio_cache WHERE id = 'main'");

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    data: JSON.parse(row.data as string),
    updatedAt: row.updatedAt as string,
  };
}
