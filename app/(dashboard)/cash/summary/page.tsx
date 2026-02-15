"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Printer,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  Landmark,
  History,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";
import api from "@/services/api";
import { useAuth } from "@/app/context/auth-context";

/* ================= TYPES ================= */

type CashInItem = {
  id: number;
  transaction_date: string;
  amount: number;
  paid_amount: number;
  source_type: "manual" | "invoice" | "customer_payment";
  customer_name: string;
  notes?: string | null;
};

type CashOutItem = {
  id: number;
  transaction_date: string;
  amount: number;
  name: string;
  entry_type: "expense" | "purchase";
  notes?: string | null;
};

/* ================= HELPERS ================= */

const toDateOnly = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const formatCardDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const formatLocalDate = (d: Date) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const getPreviousDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);

/* ================= COMPONENT ================= */

export default function CashSummaryPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [cashIn, setCashIn] = useState<CashInItem[]>([]);
  const [cashOut, setCashOut] = useState<CashOutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeOpeningBalance, setIncludeOpeningBalance] = useState(true);

  const today = formatLocalDate(new Date());
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  /* ================= FETCH ================= */

  useEffect(() => {
    if (!user?.branch_id) return;
    (async () => {
      try {
        const [inRes, outRes] = await Promise.all([
          api.get("/cash-in", { params: { branch_id: user.branch_id } }),
          api.get("/cash/out", { params: { branch_id: user.branch_id } }),
        ]);

        const mappedCashIn = (inRes.data.data || []).map(
          (item: CashInItem) => ({
            ...item,
            notes: item.notes ?? (item as any).description ?? null,
          }),
        );

        setCashIn(mappedCashIn);
        setCashOut(outRes.data.data || []);
      } catch {
        console.error("SUMMARY FETCH ERROR");
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.branch_id]);

  /* ================= FILTER ================= */

  const inRange = (dateStr: string) => {
    const itemTime = toDateOnly(new Date(dateStr));
    const from = fromDate ? toDateOnly(new Date(fromDate + "T00:00:00")) : null;
    const to = toDate ? toDateOnly(new Date(toDate + "T00:00:00")) : null;
    if (from && itemTime < from) return false;
    if (to && itemTime > to) return false;
    return true;
  };

  const filteredCashIn = useMemo(
    () => cashIn.filter((i) => inRange(i.transaction_date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cashIn, fromDate, toDate],
  );

  const filteredCashOut = useMemo(
    () => cashOut.filter((o) => inRange(o.transaction_date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cashOut, fromDate, toDate],
  );

  /* ================= PREVIOUS DAY ================= */

  const previousDate = getPreviousDay(new Date(fromDate + "T00:00:00"));

  const prevCashIn = cashIn.filter(
    (i) =>
      toDateOnly(new Date(i.transaction_date)) === toDateOnly(previousDate),
  );
  const prevCashOut = cashOut.filter(
    (o) =>
      toDateOnly(new Date(o.transaction_date)) === toDateOnly(previousDate),
  );

  const prevSummary = useMemo(() => {
    const totalIn = prevCashIn.reduce((s, i) => {
      const val =
        i.source_type === "invoice" ? Number(i.paid_amount) : Number(i.amount);
      return s + (isNaN(val) ? 0 : val);
    }, 0);
    const totalOut = prevCashOut.reduce((s, o) => {
      const val = Number(o.amount);
      return s + (isNaN(val) ? 0 : val);
    }, 0);
    return { totalIn, totalOut, balance: totalIn - totalOut };
  }, [prevCashIn, prevCashOut]);

  const openingBalance = includeOpeningBalance ? prevSummary.balance : 0;

  /* ================= SUMMARY ================= */

  const summary = useMemo(() => {
    let totalIn = openingBalance;
    let totalOut = 0;

    filteredCashIn.forEach((i) => {
      totalIn +=
        i.source_type === "invoice" ? Number(i.paid_amount) : Number(i.amount);
    });
    filteredCashOut.forEach((o) => {
      totalOut += Number(o.amount);
    });

    return { totalIn, totalOut, balance: totalIn - totalOut };
  }, [filteredCashIn, filteredCashOut, openingBalance]);

  const expenseOut = filteredCashOut.filter((o) => o.entry_type === "expense");
  const purchaseOut = filteredCashOut.filter(
    (o) => o.entry_type === "purchase",
  );

  /* ================= PRINT ================= */

  const handlePrint = () => {
    const params = new URLSearchParams({
      from: new Date(fromDate + "T00:00:00").toISOString(),
      to: new Date(toDate + "T00:00:00").toISOString(),
      includeOpeningBalance: includeOpeningBalance ? "1" : "0",
    });
    router.push(`/cash/summary/print?${params.toString()}`);
  };

  /* ================= LOADING ================= */

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-4 space-y-4" dir="rtl">
        <Skeleton className="h-8 w-48 mx-auto" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  /* ================= RENDER ================= */

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Landmark className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">ملخص الخزنة</h1>
            <p className="text-xs text-muted-foreground">
              تقرير الوارد والمنصرف
            </p>
          </div>
        </div>
        <Button
          onClick={handlePrint}
          size="sm"
          variant="outline"
          className="gap-2"
        >
          <Printer className="h-4 w-4" />
          طباعة
        </Button>
      </div>

      {/* Date Filters + Toggle */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 border-b">
            <div>
              <Label className="text-xs text-muted-foreground">من تاريخ</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">إلى تاريخ</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          <div
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setIncludeOpeningBalance((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-semibold text-sm">
                  احتساب رصيد اليومية السابقة
                </p>
                {!includeOpeningBalance && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    سيتم تجاهل رصيد اليوم السابق
                  </p>
                )}
              </div>
            </div>
            <Switch
              checked={includeOpeningBalance}
              onCheckedChange={setIncludeOpeningBalance}
            />
          </div>
        </CardContent>
      </Card>

      {/* Previous Day Summary */}
      {includeOpeningBalance && (
        <Card className="border-dashed">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium mb-3">
              اليومية السابقة ({formatLocalDate(previousDate)})
            </p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-muted-foreground">الوارد</p>
                <p className="text-green-500 font-bold text-lg">
                  {prevSummary.totalIn}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">المنصرف</p>
                <p className="text-red-500 font-bold text-lg">
                  {prevSummary.totalOut}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">الرصيد</p>
                <p
                  className={`font-black text-lg ${prevSummary.balance >= 0 ? "text-green-500" : "text-red-500"}`}
                >
                  {prevSummary.balance}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي الوارد</p>
              <p className="text-xl font-extrabold text-green-500">
                {summary.totalIn} ج.م
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-500/5 border-red-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
              <TrendingDown className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي المنصرف</p>
              <p className="text-xl font-extrabold text-red-500">
                {summary.totalOut} ج.م
              </p>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`${summary.balance >= 0 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"}`}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${summary.balance >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}
            >
              <Landmark
                className={`h-5 w-5 ${summary.balance >= 0 ? "text-emerald-500" : "text-red-500"}`}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">رصيد الخزنة</p>
              <p
                className={`text-xl font-black ${summary.balance >= 0 ? "text-emerald-500" : "text-red-500"}`}
              >
                {summary.balance} ج.م
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* الوارد */}
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownCircle className="h-4 w-4 text-green-500" />
                <h2 className="font-bold text-sm">الوارد</h2>
              </div>
              <Badge variant="secondary" className="text-[11px]">
                {filteredCashIn.length} عملية
              </Badge>
            </div>

            <div className="p-4">
              {filteredCashIn.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  لا توجد بيانات
                </p>
              )}

              {filteredCashIn.map((i, idx) => (
                <div
                  key={i.id}
                  className={`py-3 space-y-1.5 ${idx > 0 ? "border-t" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">{i.customer_name}</span>
                    <span className="text-green-500 font-extrabold tabular-nums">
                      {i.source_type === "invoice" ? i.paid_amount : i.amount}{" "}
                      ج.م
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <CalendarDays className="h-3 w-3" />
                      {formatCardDate(i.transaction_date)}
                    </div>
                    <Badge
                      className="text-[10px] px-1.5 py-0"
                      variant={
                        i.source_type === "invoice"
                          ? "secondary"
                          : i.source_type === "customer_payment"
                            ? "default"
                            : "outline"
                      }
                    >
                      {i.source_type === "invoice"
                        ? "فاتورة"
                        : i.source_type === "customer_payment"
                          ? "سداد عميل"
                          : "وارد يدوي"}
                    </Badge>
                  </div>
                  {i.notes && (
                    <p className="text-[11px] text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 rounded px-2 py-1">
                      {i.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* المنصرف */}
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpCircle className="h-4 w-4 text-red-500" />
                <h2 className="font-bold text-sm">المنصرف</h2>
              </div>
              <Badge variant="secondary" className="text-[11px]">
                {filteredCashOut.length} عملية
              </Badge>
            </div>

            <div className="p-4">
              {filteredCashOut.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  لا توجد بيانات
                </p>
              )}

              {filteredCashOut.map((o, idx) => (
                <div
                  key={o.id}
                  className={`py-3 space-y-1.5 ${idx > 0 ? "border-t" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">{o.name}</span>
                    <span className="text-red-500 font-extrabold tabular-nums">
                      {o.amount} ج.م
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <CalendarDays className="h-3 w-3" />
                      {formatCardDate(o.transaction_date)}
                    </div>
                    <Badge
                      variant={
                        o.entry_type === "purchase" ? "default" : "destructive"
                      }
                      className="text-[10px] px-1.5 py-0"
                    >
                      {o.entry_type === "purchase" ? "مشتريات" : "مصروفات"}
                    </Badge>
                  </div>
                  {o.notes && (
                    <p className="text-[11px] text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 rounded px-2 py-1">
                      {o.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
