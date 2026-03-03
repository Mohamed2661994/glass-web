"use client";

import { useEffect, useState, useCallback } from "react";
import { API_URL } from "@/services/api";
import {
  Server,
  RefreshCw,
  Clock,
  Wifi,
  WifiOff,
  HardDrive,
  Download,
  Database,
  Loader2,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Shield,
  Cloud,
  CloudOff,
  ArrowRightLeft,
  Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface HealthData {
  status: string;
  activeDb: string;
  localAlive: boolean;
  cloudAlive: boolean;
  syncInProgress: boolean;
  lastSync: {
    ok: boolean;
    synced: number;
    errors: number;
    duration: string;
    time: string;
    message?: string;
  } | null;
  failoverHistory: { from: string; to: string; time: string; reason: string }[];
  lastBackup: {
    file: string;
    time: string;
    count: number;
  } | null;
  uptime: number;
  timestamp: string;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d} يوم ${h} ساعة`;
  if (h > 0) return `${h} ساعة ${m} دقيقة`;
  return `${m} دقيقة`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("ar-EG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} ساعة`;
  return `منذ ${Math.floor(hrs / 24)} يوم`;
}

const SYNC_INTERVAL_MS = 5 * 60 * 1000;

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getSyncCountdown(lastSyncIso: string, nowMs: number): string {
  const diff = Math.max(0, nowMs - new Date(lastSyncIso).getTime());
  const remaining = SYNC_INTERVAL_MS - (diff % SYNC_INTERVAL_MS || 0);
  return formatCountdown(remaining);
}

export function DbStatusIndicator() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  // Action states
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [actionMsg, setActionMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Confirm dialog
  const [confirmRestore, setConfirmRestore] = useState(false);

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
    const interval = setInterval(fetchHealth, 30_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Clear action message after 5s
  useEffect(() => {
    if (actionMsg) {
      const t = setTimeout(() => setActionMsg(null), 5000);
      return () => clearTimeout(t);
    }
  }, [actionMsg]);

  // SSE stream reader for progress endpoints
  const streamAction = useCallback(
    async (
      url: string,
      body: object | null,
      setActive: (v: boolean) => void,
    ) => {
      setActive(true);
      setProgress(0);
      setProgressMsg("جاري التحضير...");
      setActionMsg(null);
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_URL}${url}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!response.ok || !response.body) {
          const errText = await response.text();
          let errMsg = "حدث خطأ";
          try {
            errMsg = JSON.parse(errText).error || errMsg;
          } catch {}
          throw new Error(errMsg);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const payload = JSON.parse(line.slice(6));
                if (payload.progress !== undefined)
                  setProgress(payload.progress);
                if (payload.message) setProgressMsg(payload.message);
                if (payload.done) {
                  setActionMsg({ type: "success", text: payload.message });
                  setProgress(0);
                  setProgressMsg("");
                  await fetchHealth();
                }
                if (payload.error) {
                  setActionMsg({ type: "error", text: payload.message });
                  setProgress(0);
                  setProgressMsg("");
                }
              } catch {}
            }
          }
        }
      } catch (err: any) {
        setActionMsg({
          type: "error",
          text: err.message || "حدث خطأ غير متوقع",
        });
        setProgress(0);
        setProgressMsg("");
      } finally {
        setActive(false);
      }
    },
    [fetchHealth],
  );

  const handleBackup = () => {
    streamAction("/admin/backup", null, setBackingUp);
  };

  const handleRestore = () => {
    setConfirmRestore(false);
    streamAction("/admin/restore", {}, setRestoring);
  };

  const handleSync = async () => {
    setSyncing(true);
    setActionMsg(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/admin/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (data.ok) {
        setActionMsg({
          type: "success",
          text: `تم المزامنة: ${data.synced} صف في ${data.duration}`,
        });
      } else {
        setActionMsg({
          type: "error",
          text: data.message || "فشل المزامنة",
        });
      }
      await fetchHealth();
    } catch (err: any) {
      setActionMsg({ type: "error", text: err.message || "خطأ في المزامنة" });
    } finally {
      setSyncing(false);
    }
  };

  const handleSwitch = async (target: "local" | "cloud") => {
    setSwitching(true);
    setActionMsg(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/admin/switch-db`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ target }),
      });
      const data = await res.json();
      if (data.ok) {
        setActionMsg({
          type: "success",
          text: `تم التبديل إلى ${target === "local" ? "المحلي" : "الكلاود"}`,
        });
      } else {
        setActionMsg({ type: "error", text: data.error || "فشل التبديل" });
      }
      await fetchHealth();
    } catch (err: any) {
      setActionMsg({ type: "error", text: err.message || "خطأ في التبديل" });
    } finally {
      setSwitching(false);
    }
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="flex items-center gap-3 py-3 px-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            جاري فحص الاتصال...
          </span>
        </CardContent>
      </Card>
    );
  }

  if (error || !health) {
    return (
      <Card className="border-red-500/30 bg-red-500/5">
        <CardContent className="flex items-center gap-3 py-3 px-4">
          <WifiOff className="h-5 w-5 text-red-500" />
          <div className="flex-1">
            <span className="text-sm font-medium text-red-600 dark:text-red-400">
              غير متصل بالسيرفر
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchHealth}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card
        className={`transition-all duration-300 ${
          health.activeDb === "local"
            ? "border-green-500/20 bg-gradient-to-l from-green-500/5 to-transparent"
            : "border-blue-500/20 bg-gradient-to-l from-blue-500/5 to-transparent"
        }`}
      >
        <CardContent className="p-0">
          {/* ── الصف الرئيسي ── */}
          <div
            className="flex items-center gap-3 py-3 px-4 cursor-pointer select-none"
            onClick={() => setExpanded(!expanded)}
          >
            {/* أيقونة + حالة */}
            <div className="relative">
              <div
                className={`rounded-lg p-2 ${
                  health.activeDb === "local"
                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                }`}
              >
                {health.activeDb === "local" ? (
                  <Server className="h-5 w-5" />
                ) : (
                  <Cloud className="h-5 w-5" />
                )}
              </div>
              <span
                className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background animate-pulse ${
                  health.localAlive && health.cloudAlive
                    ? "bg-green-500"
                    : health.localAlive || health.cloudAlive
                      ? "bg-amber-500"
                      : "bg-red-500"
                }`}
              />
            </div>

            {/* معلومات الاتصال */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">
                  {health.activeDb === "local"
                    ? "السيرفر المحلي"
                    : "سيرفر الكلاود"}
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${
                    health.activeDb === "local"
                      ? "border-green-500/40 text-green-600 dark:text-green-400"
                      : "border-blue-500/40 text-blue-600 dark:text-blue-400"
                  }`}
                >
                  <Wifi className="h-2.5 w-2.5 ml-1" />
                  نشط
                </Badge>
                {/* Status dots for both DBs */}
                <div className="flex items-center gap-1.5 mr-1">
                  <Tooltip>
                    <TooltipTrigger>
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${health.localAlive ? "bg-green-500" : "bg-red-500"}`}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      المحلي: {health.localAlive ? "متصل" : "غير متصل"}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger>
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${health.cloudAlive ? "bg-blue-500" : "bg-red-500"}`}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      الكلاود: {health.cloudAlive ? "متصل" : "غير متصل"}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <span>تشغيل: {formatUptime(health.uptime)}</span>
                {health.syncInProgress ? (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium animate-pulse">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      جاري المزامنة...
                    </span>
                  </>
                ) : health.lastSync?.time ? (
                  <>
                    <span>•</span>
                    <span>
                      المزامنة القادمة: {getSyncCountdown(health.lastSync.time, nowMs)}
                    </span>
                  </>
                ) : null}
                {health.lastBackup && (
                  <>
                    <span>•</span>
                    <span>باك أب: {timeAgo(health.lastBackup.time)}</span>
                  </>
                )}
              </div>
            </div>

            {/* أزرار */}
            <div className="flex items-center gap-1">
              {/* زرار التحويل اليدوي */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className={`h-8 w-8 ${switching ? "animate-pulse" : ""}`}
                    disabled={switching}
                    onClick={(e) => {
                      e.stopPropagation();
                      const target =
                        health.activeDb === "local" ? "cloud" : "local";
                      handleSwitch(target);
                    }}
                  >
                    {switching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  تبديل إلى {health.activeDb === "local" ? "الكلاود" : "المحلي"}
                </TooltipContent>
              </Tooltip>

              {expanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>

          {/* ── رسالة النتيجة ── */}
          {actionMsg && (
            <div
              className={`mx-4 mb-2 flex items-center gap-2 rounded-md px-3 py-2 text-xs ${
                actionMsg.type === "success"
                  ? "bg-green-500/10 text-green-700 dark:text-green-400"
                  : "bg-red-500/10 text-red-700 dark:text-red-400"
              }`}
            >
              {actionMsg.type === "success" ? (
                <CheckCircle className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 shrink-0" />
              )}
              {actionMsg.text}
            </div>
          )}

          {/* ── شريط التقدم ── */}
          {(backingUp || restoring) && progress > 0 && (
            <div className="mx-4 mb-2 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {progressMsg}
                </span>
                <span className="font-mono font-bold text-sm tabular-nums">
                  {progress}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${
                    progress >= 100 ? "bg-green-500" : "bg-primary"
                  }`}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* ── القسم الموسع ── */}
          {expanded && (
            <div className="border-t px-4 py-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
              {/* حالة قواعد البيانات */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* المحلي */}
                <div
                  className={`rounded-lg p-2.5 border ${
                    health.localAlive
                      ? "border-green-500/30 bg-green-500/5"
                      : "border-red-500/30 bg-red-500/5"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Server className="h-3.5 w-3.5" />
                    <span className="font-medium">المحلي</span>
                    {health.activeDb === "local" && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] px-1 py-0 h-4"
                      >
                        نشط
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${health.localAlive ? "bg-green-500" : "bg-red-500"}`}
                    />
                    <span
                      className={
                        health.localAlive
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }
                    >
                      {health.localAlive ? "متصل" : "غير متصل"}
                    </span>
                  </div>
                  {health.activeDb !== "local" && health.localAlive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] mt-1 w-full"
                      disabled={switching}
                      onClick={() => handleSwitch("local")}
                    >
                      تبديل للمحلي
                    </Button>
                  )}
                </div>

                {/* الكلاود */}
                <div
                  className={`rounded-lg p-2.5 border ${
                    health.cloudAlive
                      ? "border-blue-500/30 bg-blue-500/5"
                      : "border-red-500/30 bg-red-500/5"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Cloud className="h-3.5 w-3.5" />
                    <span className="font-medium">الكلاود</span>
                    {health.activeDb === "cloud" && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] px-1 py-0 h-4"
                      >
                        نشط
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${health.cloudAlive ? "bg-blue-500" : "bg-red-500"}`}
                    />
                    <span
                      className={
                        health.cloudAlive
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-red-600 dark:text-red-400"
                      }
                    >
                      {health.cloudAlive ? "متصل" : "غير متصل"}
                    </span>
                  </div>
                  {health.activeDb !== "cloud" && health.cloudAlive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] mt-1 w-full"
                      disabled={switching}
                      onClick={() => handleSwitch("cloud")}
                    >
                      تبديل للكلاود
                    </Button>
                  )}
                </div>
              </div>

              {/* تفاصيل المزامنة */}
              {health.lastSync && (
                <div className="rounded-lg border p-2.5 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    آخر مزامنة
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={
                        health.lastSync.ok
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }
                    >
                      {health.lastSync.ok ? "✅ ناجحة" : "❌ فشلت"}
                    </span>
                    {health.lastSync.synced !== undefined && (
                      <span>{health.lastSync.synced} صف</span>
                    )}
                    {health.lastSync.duration && (
                      <span>{health.lastSync.duration}</span>
                    )}
                    {health.lastSync.time && (
                      <span className="text-muted-foreground">
                        القادم بعد: {getSyncCountdown(health.lastSync.time, nowMs)}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* تفاصيل إضافية */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1.5">
                  <div className="text-muted-foreground font-medium">
                    آخر فحص
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {formatTime(health.timestamp)}
                  </div>
                </div>
                {health.lastBackup && (
                  <div className="space-y-1.5">
                    <div className="text-muted-foreground font-medium">
                      نسخ محفوظة
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5" />
                      {health.lastBackup.count} نسخ
                    </div>
                  </div>
                )}
              </div>

              {/* أزرار الإجراءات */}
              <div className="flex flex-wrap gap-2 pt-1">
                {/* مزامنة */}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  disabled={syncing || !health.localAlive || !health.cloudAlive}
                  onClick={handleSync}
                >
                  {syncing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                  )}
                  مزامنة الآن
                </Button>

                {/* باك أب */}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  disabled={backingUp}
                  onClick={handleBackup}
                >
                  {backingUp ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <HardDrive className="h-3.5 w-3.5" />
                  )}
                  باك أب يدوي
                </Button>

                {/* ريستور */}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  disabled={restoring}
                  onClick={() => setConfirmRestore(true)}
                >
                  {restoring ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  ريستور من Drive
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── تأكيد الريستور ── */}
      <Dialog open={confirmRestore} onOpenChange={setConfirmRestore}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Download className="h-5 w-5" />
              تأكيد الريستور
            </DialogTitle>
            <DialogDescription>
              سيتم استعادة آخر نسخة احتياطية من Google Drive على{" "}
              <strong>السيرفر المحلي</strong>. هذا سيستبدل كل البيانات الحالية!
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmRestore(false)}
            >
              إلغاء
            </Button>
            <Button size="sm" variant="destructive" onClick={handleRestore}>
              تأكيد الريستور
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
