"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useUnifiedSearch, UnifiedSearchResult } from "@/hooks/use-stock";
import { cn } from "@/lib/utils";

interface StockSearchProps {
  onSelect: (result: UnifiedSearchResult) => void;
  placeholder?: string;
  className?: string;
}

export function StockSearch({
  onSelect,
  placeholder = "搜索股票或基金",
  className,
}: StockSearchProps) {
  const [keyword, setKeyword] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const { results, loading, search, clear } = useUnifiedSearch();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      if (keyword.trim()) {
        search(keyword.trim());
        setIsOpen(true);
      } else {
        clear();
        setIsOpen(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [keyword, search, clear]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (result: UnifiedSearchResult) => {
    onSelect(result);
    setKeyword("");
    setIsOpen(false);
    clear();
  };

  const handleClear = () => {
    setKeyword("");
    clear();
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          className="pl-9 pr-9 border-border/50 bg-secondary text-foreground placeholder:text-muted-foreground"
        />
        {keyword && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-auto rounded-lg border border-border bg-card shadow-lg">
          {loading ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              搜索中...
            </div>
          ) : results.length > 0 ? (
            <ul>
              {results.map((item) => (
                <li key={`${item.type}-${item.code}`}>
                  <button
                    onClick={() => handleSelect(item)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-secondary transition-colors"
                  >
                    <div>
                      <span className="font-medium text-foreground">
                        {item.name}
                      </span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {item.code}
                      </span>
                    </div>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded",
                      item.type === "fund"
                        ? "bg-blue-500/10 text-blue-500"
                        : "bg-green-500/10 text-green-500"
                    )}>
                      {item.type === "fund" ? "基金" : item.subType}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : keyword ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              未找到相关股票或基金
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
