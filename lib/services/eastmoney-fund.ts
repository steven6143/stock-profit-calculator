import type { FundQuote, FundNetWorthData, FundSearchResult, ChartDataPoint } from "@/lib/types/stock";

const FUND_DATA_URL = "https://fund.eastmoney.com/pingzhongdata/";
const FUND_SEARCH_URL = "https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx";

// 获取基金实时数据和净值走势
export async function fetchFundData(code: string): Promise<{
  quote: FundQuote | null;
  netWorthTrend: FundNetWorthData[];
}> {
  try {
    const response = await fetch(`${FUND_DATA_URL}${code}.js`, {
      headers: {
        Referer: "https://fund.eastmoney.com",
      },
      next: { revalidate: 60 },
    });

    const text = await response.text();

    // 解析基金名称和代码
    const nameMatch = text.match(/var fS_name = "(.+?)"/);
    const codeMatch = text.match(/var fS_code = "(.+?)"/);

    if (!nameMatch || !codeMatch) {
      return { quote: null, netWorthTrend: [] };
    }

    // 解析净值走势数据
    const trendMatch = text.match(/var Data_netWorthTrend = (\[[\s\S]*?\]);/);
    let netWorthTrend: FundNetWorthData[] = [];
    let latestNetWorth = 0;
    let dayGrowth = 0;

    if (trendMatch) {
      try {
        const trendData = JSON.parse(trendMatch[1]);
        netWorthTrend = trendData.map((item: { x: number; y: number; equityReturn: number }) => {
          const date = new Date(item.x);
          return {
            day: date.toISOString().split("T")[0],
            netWorth: item.y,
            totalWorth: item.y,
            dayGrowth: item.equityReturn || 0,
          };
        });

        // 获取最新净值
        if (netWorthTrend.length > 0) {
          const latest = netWorthTrend[netWorthTrend.length - 1];
          latestNetWorth = latest.netWorth;
          dayGrowth = latest.dayGrowth;
        }
      } catch {
        console.error("解析净值走势数据失败");
      }
    }

    // 尝试获取累计净值走势
    const totalTrendMatch = text.match(/var Data_ACWorthTrend = (\[[\s\S]*?\]);/);
    if (totalTrendMatch && netWorthTrend.length > 0) {
      try {
        const totalData = JSON.parse(totalTrendMatch[1]);
        const totalMap = new Map<string, number>();
        totalData.forEach((item: [number, number]) => {
          const date = new Date(item[0]).toISOString().split("T")[0];
          totalMap.set(date, item[1]);
        });

        netWorthTrend = netWorthTrend.map(item => ({
          ...item,
          totalWorth: totalMap.get(item.day) || item.netWorth,
        }));
      } catch {
        // 忽略累计净值解析错误
      }
    }

    const quote: FundQuote = {
      code: codeMatch[1],
      name: nameMatch[1],
      netWorth: latestNetWorth,
      totalWorth: latestNetWorth,
      dayGrowth,
      lastUpdate: netWorthTrend.length > 0 ? netWorthTrend[netWorthTrend.length - 1].day : "",
    };

    return { quote, netWorthTrend };
  } catch (error) {
    console.error("获取基金数据失败:", error);
    return { quote: null, netWorthTrend: [] };
  }
}

// 搜索基金
export async function searchFund(keyword: string): Promise<FundSearchResult[]> {
  try {
    const url = `${FUND_SEARCH_URL}?callback=jQuery&m=1&key=${encodeURIComponent(keyword)}`;
    const response = await fetch(url, {
      headers: {
        Referer: "https://fund.eastmoney.com",
      },
      next: { revalidate: 300 },
    });

    const text = await response.text();
    // 解析 JSONP: jQuery({...})
    const match = text.match(/jQuery\((.+)\)/);
    if (!match) return [];

    const data = JSON.parse(match[1]);
    if (!data.Datas || !Array.isArray(data.Datas)) return [];

    return data.Datas.slice(0, 10).map((item: { CODE: string; NAME: string; FundBaseInfo?: { FTYPE?: string } }) => ({
      code: item.CODE,
      name: item.NAME,
      type: item.FundBaseInfo?.FTYPE || "基金",
    }));
  } catch (error) {
    console.error("搜索基金失败:", error);
    return [];
  }
}

// 根据时间范围过滤净值数据
export function filterNetWorthByRange(
  data: FundNetWorthData[],
  range: string
): FundNetWorthData[] {
  if (data.length === 0) return [];

  const now = new Date();
  let startDate: Date;

  switch (range) {
    case "1D":
      // 基金没有日内数据，返回最近一天
      return data.slice(-1);
    case "1W":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "1M":
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
    case "3M":
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case "1Y":
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    case "ALL":
      startDate = new Date(now.getFullYear() - 4, now.getMonth(), now.getDate());
      break;
    default:
      return data.slice(-30);
  }

  return data.filter(item => new Date(item.day) >= startDate);
}

// 转换为图表数据格式
export function toChartData(data: FundNetWorthData[]): ChartDataPoint[] {
  return data.map(item => ({
    time: item.day,
    price: item.netWorth,
  }));
}
