"use client";

import { useEffect, useState, useCallback } from "react";
import { API_URL } from "@/services/api";
import {
  Database,
  Cloud,
  Server,
  RefreshCw,
  Clock,
  Wifi,
  WifiOff,
  HardDrive,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HealthData {
  status: string;
  activeDb: "local" | "neon";
  lastFailoverTime: string | null;
  lastFailbackTime: string | null;
  lastBackup: {
    file: string;
    time: string;
    count: number;
  } | null;
  uptime: number;
  timestamp: string;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} ساعة ${m} دقيقة`;
  return `${m} دقيقة`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("ar-EG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function DbStatusIndicator() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
      const data = await res.json();
      setHealth(data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30_000); // كل 30 ثانية
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-muted-foreground animate-pulse">
        <Database className="h-4 w-4" />
        <span>جاري الفحص...</span>
      </div>
    );
  }

  if (error || !health) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-600 dark:text-red-400">
        <WifiOff className="h-4 w-4" />
        <span>غير متصل بالسيرفر</span>
        <button onClick={fetchHealth} className="mr-auto hover:opacity-70">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  const isLocal = health.activeDb === "local";

  return (
    <TooltipProvider>
      <div
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
          isLocal
            ? "border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400"
            : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
        }`}
      >
        {/* أيقونة الاتصال مع نقطة الحالة */}
        <div className="relative">
          {isLocal ? (
            <Server className="h-4 w-4" />
          ) : (
            <Cloud className="h-4 w-4" />
          )}
          <span
            className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ${
              isLocal ? "bg-green-500" : "bg-amber-500"
            } animate-pulse`}
          />
        </div>

        {/* اسم قاعدة البيانات */}
        <span className="font-medium">{isLocal ? "المحلي" : "Neon Cloud"}</span>

        {/* فاصل */}
        <span className="text-muted-foreground/30">|</span>

        {/* حالة الاتصال */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 cursor-default">
              <Wifi className="h-3.5 w-3.5" />
              <span className="text-xs">متصل</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>آخر فحص: {formatTime(health.timestamp)}</span>
              </div>
              <div>مدة التشغيل: {formatUptime(health.uptime)}</div>
            </div>
          </TooltipContent>
        </Tooltip>

        {/* آخر تحويل */}
        {(health.lastFailoverTime || health.lastFailbackTime) && (
          <>
            <span className="text-muted-foreground/30">|</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 cursor-default">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-xs">
                    {health.lastFailoverTime && !isLocal
                      ? `تحويل: ${formatTime(health.lastFailoverTime)}`
                      : health.lastFailbackTime && isLocal
                        ? `رجوع: ${formatTime(health.lastFailbackTime)}`
                        : ""}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {health.lastFailoverTime && (
                  <div>
                    آخر تحويل لـ Neon: {formatTime(health.lastFailoverTime)}
                  </div>
                )}
                {health.lastFailbackTime && (
                  <div>
                    آخر رجوع للمحلي: {formatTime(health.lastFailbackTime)}
                  </div>
                )}
              </TooltipContent>
            </Tooltip>
          </>
        )}

        {/* آخر باك أب */}
        {health.lastBackup && (
          <>
            <span className="text-muted-foreground/30">|</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 cursor-default">
                  <HardDrive className="h-3.5 w-3.5" />
                  <span className="text-xs">
                    باك أب: {formatTime(health.lastBackup.time)}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <div className="space-y-1">
                  <div>الملف: {health.lastBackup.file}</div>
                  <div>عدد النسخ: {health.lastBackup.count}</div>
                </div>
              </TooltipContent>
            </Tooltip>
          </>
        )}

        {/* زر تحديث */}
        <button
          onClick={fetchHealth}
          className="mr-auto hover:opacity-70 transition-opacity"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    </TooltipProvider>
  );
}
