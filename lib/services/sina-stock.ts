import type { StockQuote, KLineData, StockSearchResult } from "@/lib/types/stock";

const SINA_QUOTE_URL = "https://hq.sinajs.cn/list=";
const SINA_KLINE_URL =
  "https://quotes.sina.cn/cn/api/jsonp_v2.php/var%20_data=/CN_MarketDataService.getKLineData";
const SINA_SEARCH_URL =
  "https://suggest3.sinajs.cn/suggest/type=11,12,13,14,15&name=suggestdata&key=";

// 解析实时行情
export async function fetchStockQuote(code: string): Promise<StockQuote | null> {
  try {
    const response = await fetch(`${SINA_QUOTE_URL}${code}`, {
      headers: {
        Referer: "https://finance.sina.com.cn",
      },
      next: { revalidate: 10 }, // 10秒缓存
    });

    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder("gbk");
    const text = decoder.decode(buffer);

    // 解析: var hq_str_sh600519="贵州茅台,..."
    const match = text.match(/="(.*)"/);
    if (!match || !match[1]) return null;

    const parts = match[1].split(",");
    if (parts.length < 32) return null;

    const currentPrice = parseFloat(parts[3]);
    const close = parseFloat(parts[2]);
    const change = currentPrice - close;
    const changePercent = close > 0 ? (change / close) * 100 : 0;

    return {
      code,
      name: parts[0],
      currentPrice,
      open: parseFloat(parts[1]),
      close,
      high: parseFloat(parts[4]),
      low: parseFloat(parts[5]),
      volume: parseInt(parts[8]),
      amount: parseFloat(parts[9]),
      change,
      changePercent,
      date: parts[30],
      time: parts[31],
    };
  } catch (error) {
    console.error("获取股票行情失败:", error);
    return null;
  }
}

// 获取K线数据
export async function fetchKLineData(
  code: string,
  scale: number = 240,
  datalen: number = 30
): Promise<KLineData[]> {
  try {
    const url = `${SINA_KLINE_URL}?symbol=${code}&scale=${scale}&ma=no&datalen=${datalen}`;
    const response = await fetch(url, {
      headers: {
        Referer: "https://finance.sina.com.cn",
      },
      next: { revalidate: 60 }, // 1分钟缓存
    });

    const text = await response.text();
    // 解析 JSONP: var _data=([{...}]);
    const match = text.match(/\((\[.*\])\)/);
    if (!match) return [];

    const data = JSON.parse(match[1]);
    return data.map((item: Record<string, string>) => ({
      day: item.day,
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseInt(item.volume),
    }));
  } catch (error) {
    console.error("获取K线数据失败:", error);
    return [];
  }
}

// 搜索股票
export async function searchStock(keyword: string): Promise<StockSearchResult[]> {
  try {
    const response = await fetch(
      `${SINA_SEARCH_URL}${encodeURIComponent(keyword)}`,
      {
        headers: {
          Referer: "https://finance.sina.com.cn",
        },
        next: { revalidate: 300 }, // 5分钟缓存
      }
    );

    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder("gbk");
    const text = decoder.decode(buffer);

    // 解析: var suggestdata="name,type,code,...;..."
    const match = text.match(/="(.*)"/);
    if (!match || !match[1]) return [];

    return match[1]
      .split(";")
      .filter(Boolean)
      .map((item) => {
        const parts = item.split(",");
        return {
          name: parts[0],
          type: parts[1],
          code: parts[3],
        };
      })
      .filter((item) => item.code && item.name);
  } catch (error) {
    console.error("搜索股票失败:", error);
    return [];
  }
}

// 根据时间范围获取K线参数
export function getKLineParams(range: string): { scale: number; datalen: number } {
  switch (range) {
    case "1D":
      return { scale: 5, datalen: 48 }; // 5分钟K线，48条
    case "1W":
      return { scale: 30, datalen: 56 }; // 30分钟K线，7天
    case "1M":
      return { scale: 240, datalen: 22 }; // 日K，22个交易日
    case "3M":
      return { scale: 240, datalen: 66 }; // 日K，66个交易日
    case "1Y":
      return { scale: 240, datalen: 250 }; // 日K，250个交易日
    case "ALL":
      return { scale: 240, datalen: 1000 }; // 日K，最多1000条
    default:
      return { scale: 5, datalen: 48 };
  }
}
