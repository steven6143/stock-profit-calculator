// 价格缓存模块 - 缓存实时价格数据，避免频繁请求

interface CachedPrice {
  price: number;
  timestamp: number;
}

// 内存缓存
const priceCache = new Map<string, CachedPrice>();

// 缓存有效期（毫秒）- 30秒
const CACHE_TTL = 30 * 1000;

/**
 * 获取缓存的价格
 * @param code 资产代码
 * @returns 缓存的价格，如果过期或不存在返回 null
 */
export function getCachedPrice(code: string): number | null {
  const cached = priceCache.get(code);
  if (!cached) return null;

  // 检查是否过期
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    priceCache.delete(code);
    return null;
  }

  return cached.price;
}

/**
 * 设置价格缓存
 * @param code 资产代码
 * @param price 价格
 */
export function setCachedPrice(code: string, price: number): void {
  priceCache.set(code, {
    price,
    timestamp: Date.now(),
  });
}

/**
 * 批量获取缓存的价格
 * @param codes 资产代码数组
 * @returns Map<code, price | null>
 */
export function getBatchCachedPrices(codes: string[]): Map<string, number | null> {
  const result = new Map<string, number | null>();
  for (const code of codes) {
    result.set(code, getCachedPrice(code));
  }
  return result;
}

/**
 * 批量设置价格缓存
 * @param prices Map<code, price>
 */
export function setBatchCachedPrices(prices: Map<string, number>): void {
  for (const [code, price] of prices) {
    setCachedPrice(code, price);
  }
}

/**
 * 清除所有缓存
 */
export function clearPriceCache(): void {
  priceCache.clear();
}
