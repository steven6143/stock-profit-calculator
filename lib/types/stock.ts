// 实时行情数据
export interface StockQuote {
  code: string; // sh600519
  name: string; // 贵州茅台
  currentPrice: number; // 当前价格
  open: number; // 今开
  close: number; // 昨收
  high: number; // 最高
  low: number; // 最低
  volume: number; // 成交量（股）
  amount: number; // 成交额（元）
  change: number; // 涨跌额
  changePercent: number; // 涨跌幅
  time: string; // 更新时间
  date: string; // 日期
}

// K线数据点
export interface KLineData {
  day: string; // 日期 2024-01-15
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// 搜索结果
export interface StockSearchResult {
  code: string; // sh600519
  name: string; // 贵州茅台
  type: string; // 11 = A股
}

// 持仓信息
export interface Position {
  id: string;
  stockCode: string;
  stockName: string;
  costPrice: number;
  shares: number;
  createdAt: Date;
  updatedAt: Date;
}

// 持仓盈亏计算结果
export interface PositionWithProfit extends Position {
  currentPrice: number;
  totalCost: number; // 持仓成本 = costPrice * shares
  marketValue: number; // 当前市值 = currentPrice * shares
  profit: number; // 盈亏金额
  profitPercent: number; // 盈亏比例
}

// API 响应类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// 股票信息（用于前端展示）
export interface StockInfo {
  symbol: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  marketCap: string;
  pe: number;
}

// 图表数据点
export interface ChartDataPoint {
  time: string;
  price: number;
}
