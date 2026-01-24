"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AssetType } from "@/lib/types/stock";

interface PositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  costPrice: string;
  shares: string;
  onSave: (costPrice: string, shares: string) => void;
  onClear?: () => void;
  hasPosition?: boolean;
  assetType?: AssetType;
}

export function PositionDialog({
  open,
  onOpenChange,
  costPrice,
  shares,
  onSave,
  onClear,
  hasPosition,
  assetType = "stock",
}: PositionDialogProps) {
  const [localCostPrice, setLocalCostPrice] = useState(costPrice);
  const [localShares, setLocalShares] = useState(shares);
  const isFund = assetType === "fund";

  useEffect(() => {
    if (open) {
      setLocalCostPrice(costPrice);
      setLocalShares(shares);
    }
  }, [open, costPrice, shares]);

  const handleSave = () => {
    // 先让输入框失去焦点，收起键盘
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    onSave(localCostPrice, localShares);
    onOpenChange(false);
    // 延迟滚动，等待键盘收起和弹窗关闭
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 300);
  };

  const handleClear = () => {
    // 先让输入框失去焦点，收起键盘
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    if (onClear) {
      onClear();
    } else {
      onSave("", "");
    }
    onOpenChange(false);
    // 延迟滚动，等待键盘收起和弹窗关闭
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">设置持仓信息</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="dialog-cost" className="text-muted-foreground">
              {isFund ? "成本净值 (元)" : "成本价 (元)"}
            </Label>
            <Input
              id="dialog-cost"
              type="number"
              step="0.000001"
              placeholder={isFund ? "输入您的买入净值" : "输入您的买入均价"}
              value={localCostPrice}
              onChange={(e) => setLocalCostPrice(e.target.value)}
              className="border-border/50 bg-secondary text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dialog-shares" className="text-muted-foreground">
              {isFund ? "持有份额" : "持有股数"}
            </Label>
            <Input
              id="dialog-shares"
              type="number"
              step={isFund ? "0.01" : "100"}
              placeholder={isFund ? "输入您的持有份额" : "输入您的持股数量"}
              value={localShares}
              onChange={(e) => setLocalShares(e.target.value)}
              className="border-border/50 bg-secondary text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <DialogFooter className="flex gap-2 sm:gap-0">
          {hasPosition && (
            <Button
              variant="outline"
              onClick={handleClear}
              className="border-border/50 text-muted-foreground hover:bg-secondary hover:text-foreground bg-transparent"
            >
              清除持仓
            </Button>
          )}
          <Button
            onClick={handleSave}
            className="bg-stock-up text-white hover:bg-stock-up/90"
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
