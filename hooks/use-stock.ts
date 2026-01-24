import { useState, useEffect, useCallback } from "react";
import type {
  StockQuote,
  KLineData,
  StockSearchResult,
  Position,
  ChartDataPoint,
} from "@/lib/types/stock";

// 获取实时行情
export function useStockQuote(code: string | null) {
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuote = useCallback(async () => {
    if (!code) {
      setQuote(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/stock/quote?code=${code}`);
      const data = await res.json();

      if (data.success) {
        setQuote(data.data);
      } else {
        setError(data.error || "获取行情失败");
      }
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }, [code]);

  // 当股票代码变化时，立即清空旧数据
  useEffect(() => {
    setQuote(null);
  }, [code]);

  useEffect(() => {
    fetchQuote();
    // 每30秒刷新一次
    const interval = setInterval(fetchQuote, 30000);
    return () => clearInterval(interval);
  }, [fetchQuote]);

  return { quote, loading, error, refetch: fetchQuote };
}

// 获取K线数据
export function useKLineData(code: string | null, range: string) {
  const [data, setData] = useState<KLineData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 当股票代码变化时，立即清空旧数据
  useEffect(() => {
    setData([]);
  }, [code]);

  useEffect(() => {
    if (!code) {
      setData([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/stock/kline?code=${code}&range=${range}`);
        const result = await res.json();

        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error || "获取K线数据失败");
        }
      } catch {
        setError("网络错误");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [code, range]);

  // 转换为图表数据格式
  const chartData: ChartDataPoint[] = data.map((item) => ({
    time: item.day,
    price: item.close,
  }));

  return { data, chartData, loading, error };
}

// 搜索股票
export function useStockSearch() {
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (keyword: string) => {
    if (!keyword || keyword.length < 1) {
      setResults([]);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(
        `/api/stock/search?keyword=${encodeURIComponent(keyword)}`
      );
      const data = await res.json();

      if (data.success) {
        setResults(data.data);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResults([]);
  }, []);

  return { results, loading, search, clear };
}

// 持仓管理
export function usePosition() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 获取所有持仓
  const fetchPositions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/position");
      const data = await res.json();

      if (data.success) {
        setPositions(data.data);
      } else {
        setError(data.error || "获取持仓失败");
      }
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, []);

  // 保存持仓
  const savePosition = useCallback(
    async (position: {
      stockCode: string;
      stockName: string;
      costPrice: number;
      shares: number;
    }) => {
      try {
        const res = await fetch("/api/position", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(position),
        });
        const data = await res.json();

        if (data.success) {
          await fetchPositions();
          return true;
        } else {
          setError(data.error || "保存持仓失败");
          return false;
        }
      } catch {
        setError("网络错误");
        return false;
      }
    },
    [fetchPositions]
  );

  // 删除持仓
  const deletePosition = useCallback(
    async (stockCode: string) => {
      try {
        const res = await fetch(`/api/position?stockCode=${stockCode}`, {
          method: "DELETE",
        });
        const data = await res.json();

        if (data.success) {
          await fetchPositions();
          return true;
        } else {
          setError(data.error || "删除持仓失败");
          return false;
        }
      } catch {
        setError("网络错误");
        return false;
      }
    },
    [fetchPositions]
  );

  // 根据股票代码获取持仓
  const getPositionByCode = useCallback(
    (stockCode: string) => {
      return positions.find((p) => p.stockCode === stockCode);
    },
    [positions]
  );

  // 更新持仓访问时间（标记为最近查看）
  const touchPosition = useCallback(
    async (stockCode: string) => {
      try {
        await fetch(`/api/position?stockCode=${stockCode}`, {
          method: "PATCH",
        });
      } catch {
        // 静默失败，不影响用户体验
      }
    },
    []
  );

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  return {
    positions,
    loading,
    initialized,
    error,
    fetchPositions,
    savePosition,
    deletePosition,
    getPositionByCode,
    touchPosition,
  };
}
