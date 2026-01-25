"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface PortfolioItem {
  id: string;
  code: string;
  name: string;
  assetType: "stock" | "fund";
  costPrice: number;
  shares: number;
  currentPrice: number | null;
  totalCost: number;
  marketValue: number | null;
  profit: number | null;
  profitPercent: number | null;
}

interface PortfolioSummary {
  totalCost: number;
  totalMarketValue: number;
  totalProfit: number;
  totalProfitPercent: number;
}

interface PortfolioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectAsset?: (code: string, name: string, assetType: "stock" | "fund") => void;
}

export function PortfolioDialog({
  open,
  onOpenChange,
  onSelectAsset,
}: PortfolioDialogProps) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary>({
    totalCost: 0,
    totalMarketValue: 0,
    totalProfit: 0,
    totalProfitPercent: 0,
  });

  useEffect(() => {
    if (open) {
      fetchPortfolio();
    }
  }, [open]);

  const fetchPortfolio = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/portfolio");
      const result = await response.json();
      if (result.success && result.data) {
        setItems(result.data.items);
        setSummary(result.data.summary);
      }
    } catch (error) {
      console.error("获取投资组合失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItem = (item: PortfolioItem) => {
    if (onSelectAsset) {
      onSelectAsset(item.code, item.name, item.assetType);
    }
    onOpenChange(false);
  };

  const formatNumber = (num: number | null, decimals: number = 2): string => {
    if (num === null) return "--";
    return num.toFixed(decimals);
  };

  const formatShares = (shares: number, assetType: string): string => {
    return assetType === "fund" ? shares.toFixed(2) : shares.toString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-foreground">我的持仓</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            暂无持仓数据
          </div>
        ) : (
          <>
            {/* 持仓列表 */}
            <div className="flex-1 overflow-y-auto space-y-2 py-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectItem(item)}
                  className="p-4 rounded-lg border border-border/50 bg-secondary/50 hover:bg-secondary cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {item.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          item.assetType === "fund"
                            ? "border-blue-500/50 text-blue-500"
                            : "border-green-500/50 text-green-500"
                        }
                      >
                        {item.assetType === "fund" ? "基金" : "股票"}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {item.code}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">成本价: </span>
                      <span className="text-foreground">
                        ¥{formatNumber(item.costPrice, item.assetType === "fund" ? 4 : 2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">现价: </span>
                      <span className="text-foreground">
                        ¥{formatNumber(item.currentPrice, item.assetType === "fund" ? 4 : 2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        {item.assetType === "fund" ? "份额" : "股数"}:
                      </span>
                      <span className="text-foreground ml-1">
                        {formatShares(item.shares, item.assetType)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">市值: </span>
                      <span className="text-foreground">
                        ¥{formatNumber(item.marketValue)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-border/30 flex items-center justify-between">
                    <div>
                      <span className="text-muted-foreground text-sm">盈亏: </span>
                      <span
                        className={`font-medium ${
                          item.profit === null
                            ? "text-muted-foreground"
                            : item.profit >= 0
                            ? "text-stock-up"
                            : "text-stock-down"
                        }`}
                      >
                        {item.profit !== null && item.profit >= 0 ? "+" : ""}
                        ¥{formatNumber(item.profit)}
                      </span>
                    </div>
                    <div>
                      <span
                        className={`font-medium ${
                          item.profitPercent === null
                            ? "text-muted-foreground"
                            : item.profitPercent >= 0
                            ? "text-stock-up"
                            : "text-stock-down"
                        }`}
                      >
                        {item.profitPercent !== null && item.profitPercent >= 0
                          ? "+"
                          : ""}
                        {formatNumber(item.profitPercent)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 总计 */}
            <div className="border-t border-border pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">成本总和:</span>
                <span className="font-medium text-foreground">
                  ¥{formatNumber(summary.totalCost)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">市值总和:</span>
                <span className="font-medium text-foreground">
                  ¥{formatNumber(summary.totalMarketValue)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">盈亏总和:</span>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-semibold ${
                      summary.totalProfit >= 0
                        ? "text-stock-up"
                        : "text-stock-down"
                    }`}
                  >
                    {summary.totalProfit >= 0 ? "+" : ""}
                    ¥{formatNumber(summary.totalProfit)}
                  </span>
                  <span
                    className={`font-semibold ${
                      summary.totalProfitPercent >= 0
                        ? "text-stock-up"
                        : "text-stock-down"
                    }`}
                  >
                    ({summary.totalProfitPercent >= 0 ? "+" : ""}
                    {formatNumber(summary.totalProfitPercent)}%)
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
