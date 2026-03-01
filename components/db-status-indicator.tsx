"use client";

import { useEffect, useState, useCallback } from "react";
import { API_URL } from "@/services/api";
import api from "@/services/api";
import {
  Cloud,
  Server,
  RefreshCw,
  Clock,
  Wifi,
  WifiOff,
  HardDrive,
  ArrowLeftRight,
  Download,
  Database,
  Loader2,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Shield,
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

export function DbStatusIndicator() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  // Action states
  const [switching, setSwitching] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [actionMsg, setActionMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Confirm dialogs
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<"local" | "neon" | null>(
    null,
  );

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

  const handleSwitch = async () => {
    if (!health) return;
    setSwitching(true);
    setConfirmSwitch(false);
    setProgress(30);
    setProgressMsg("جاري اختبار الاتصال...");
    try {
      const target = health.activeDb === "local" ? "neon" : "local";
      await api.post("/admin/switch-db", { target });
      setProgress(100);
      setProgressMsg("تم!");
      setActionMsg({
        type: "success",
        text: `تم التحويل لـ ${target === "local" ? "المحلي" : "Neon"}`,
      });
      await fetchHealth();
    } catch (err: any) {
      setActionMsg({
        type: "error",
        text: err.response?.data?.error || "فشل التحويل",
      });
    } finally {
      setSwitching(false);
      setProgress(0);
      setProgressMsg("");
    }
  };

  const handleBackup = () => {
    streamAction("/admin/backup", null, setBackingUp);
  };

  const handleRestore = (target: "local" | "neon") => {
    setConfirmRestore(null);
    streamAction("/admin/restore", { target }, setRestoring);
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

  const isLocal = health.activeDb === "local";

  return (
    <TooltipProvider>
      <Card
        className={`transition-all duration-300 ${
          isLocal
            ? "border-green-500/20 bg-gradient-to-l from-green-500/5 to-transparent"
            : "border-amber-500/20 bg-gradient-to-l from-amber-500/5 to-transparent"
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
                  isLocal
                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                }`}
              >
                {isLocal ? (
                  <Server className="h-5 w-5" />
                ) : (
                  <Cloud className="h-5 w-5" />
                )}
              </div>
              <span
                className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${
                  isLocal ? "bg-green-500" : "bg-amber-500"
                } animate-pulse`}
              />
            </div>

            {/* معلومات الاتصال */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">
                  {isLocal ? "السيرفر المحلي" : "Neon Cloud"}
                </span>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${
                    isLocal
                      ? "border-green-500/40 text-green-600 dark:text-green-400"
                      : "border-amber-500/40 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  <Wifi className="h-2.5 w-2.5 ml-1" />
                  متصل
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <span>تشغيل: {formatUptime(health.uptime)}</span>
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      fetchHealth();
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>تحديث الحالة</TooltipContent>
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
          {(backingUp || restoring || switching) && progress > 0 && (
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
                    progress >= 100
                      ? "bg-green-500"
                      : "bg-primary"
                  }`}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* ── القسم الموسع ── */}
          {expanded && (
            <div className="border-t px-4 py-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
              {/* تفاصيل */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1.5">
                  <div className="text-muted-foreground font-medium">
                    قاعدة البيانات
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5" />
                    {isLocal ? "PostgreSQL محلي" : "Neon PostgreSQL"}
                  </div>
                </div>
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
                  <>
                    <div className="space-y-1.5">
                      <div className="text-muted-foreground font-medium">
                        آخر باك أب
                      </div>
                      <div className="flex items-center gap-1.5">
                        <HardDrive className="h-3.5 w-3.5" />
                        {formatTime(health.lastBackup.time)}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-muted-foreground font-medium">
                        نسخ محفوظة
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5" />
                        {health.lastBackup.count} نسخ
                      </div>
                    </div>
                  </>
                )}
                {health.lastFailoverTime && (
                  <div className="space-y-1.5">
                    <div className="text-muted-foreground font-medium">
                      آخر تحويل لـ Neon
                    </div>
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                      {formatTime(health.lastFailoverTime)}
                    </div>
                  </div>
                )}
                {health.lastFailbackTime && (
                  <div className="space-y-1.5">
                    <div className="text-muted-foreground font-medium">
                      آخر رجوع للمحلي
                    </div>
                    <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                      {formatTime(health.lastFailbackTime)}
                    </div>
                  </div>
                )}
              </div>

              {/* أزرار الإجراءات */}
              <div className="flex flex-wrap gap-2 pt-1">
                {/* تحويل */}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  disabled={switching}
                  onClick={() => setConfirmSwitch(true)}
                >
                  {switching ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                  )}
                  تحويل لـ {isLocal ? "Neon" : "المحلي"}
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

                {/* ريستور المحلي */}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  disabled={restoring}
                  onClick={() => setConfirmRestore("local")}
                >
                  {restoring ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  ريستور على المحلي
                </Button>

                {/* ريستور Neon */}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  disabled={restoring}
                  onClick={() => setConfirmRestore("neon")}
                >
                  {restoring ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  ريستور على Neon
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── تأكيد التحويل ── */}
      <Dialog open={confirmSwitch} onOpenChange={setConfirmSwitch}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              تأكيد التحويل
            </DialogTitle>
            <DialogDescription>
              {isLocal
                ? "هل تريد التحويل من السيرفر المحلي إلى Neon Cloud؟"
                : "هل تريد التحويل من Neon Cloud إلى السيرفر المحلي؟"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmSwitch(false)}
            >
              إلغاء
            </Button>
            <Button size="sm" onClick={handleSwitch}>
              تأكيد التحويل
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── تأكيد الريستور ── */}
      <Dialog
        open={!!confirmRestore}
        onOpenChange={() => setConfirmRestore(null)}
      >
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Download className="h-5 w-5" />
              تأكيد الريستور
            </DialogTitle>
            <DialogDescription>
              سيتم استعادة آخر نسخة احتياطية على{" "}
              <strong>
                {confirmRestore === "local" ? "السيرفر المحلي" : "Neon Cloud"}
              </strong>
              . هذا سيستبدل كل البيانات الحالية!
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmRestore(null)}
            >
              إلغاء
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => confirmRestore && handleRestore(confirmRestore)}
            >
              تأكيد الريستور
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
