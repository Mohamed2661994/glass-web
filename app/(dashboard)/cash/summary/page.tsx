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
import { Printer, CalendarDays } from "lucide-react";
import api from "@/services/api";

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

  const [cashIn, setCashIn] = useState<CashInItem[]>([]);
  const [cashOut, setCashOut] = useState<CashOutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeOpeningBalance, setIncludeOpeningBalance] = useState(true);

  const today = formatLocalDate(new Date());
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);

  /* ================= FETCH ================= */

  useEffect(() => {
    (async () => {
      try {
        const [inRes, outRes] = await Promise.all([
          api.get("/cash-in"),
          api.get("/cash/out", { params: { branch_id: 1 } }),
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
  }, []);

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
    <div className="max-w-5xl mx-auto p-4 space-y-4" dir="rtl">
      <h1 className="text-xl font-bold text-center">ملخص الخزنة</h1>

      {/* Print Button */}
      <Button onClick={handlePrint} className="w-full">
        <Printer className="h-4 w-4 ml-2" />
        طباعة
      </Button>

      {/* Date Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[140px]">
            <Label>من تاريخ</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <Label>إلى تاريخ</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Opening Balance Toggle */}
      <Card
        className="cursor-pointer"
        onClick={() => setIncludeOpeningBalance((v) => !v)}
      >
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-sm">احتساب رصيد اليومية السابقة</p>
            {!includeOpeningBalance && (
              <p className="text-xs text-muted-foreground mt-1">
                عند الإلغاء سيتم تجاهل رصيد اليوم السابق من الحساب
              </p>
            )}
          </div>
          <Switch
            checked={includeOpeningBalance}
            onCheckedChange={setIncludeOpeningBalance}
          />
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Previous Day */}
        {includeOpeningBalance && (
          <Card className="sm:col-span-2">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-2">
                اليومية السابقة ({formatLocalDate(previousDate)})
              </p>
              <p className="text-green-500 font-bold">
                الوارد: {prevSummary.totalIn} ج.م
              </p>
              <p className="text-red-500 font-bold">
                المنصرف: {prevSummary.totalOut} ج.م
              </p>
              <p
                className={`mt-2 text-lg font-black ${prevSummary.balance >= 0 ? "text-green-500" : "text-red-500"}`}
              >
                الرصيد: {prevSummary.balance} ج.م
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">إجمالي المنصرف</p>
            <p className="text-2xl font-extrabold text-red-500">
              {summary.totalOut} ج.م
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">إجمالي الوارد</p>
            <p className="text-2xl font-extrabold text-green-500">
              {summary.totalIn} ج.م
            </p>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">رصيد الخزنة</p>
            <p
              className={`text-3xl font-black ${summary.balance >= 0 ? "text-green-500" : "text-red-500"}`}
            >
              {summary.balance} ج.م
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* المنصرف */}
        <Card>
          <CardContent className="p-4">
            <h2 className="text-muted-foreground font-bold mb-3">المنصرف</h2>

            {filteredCashOut.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                لا توجد بيانات
              </p>
            )}

            {filteredCashOut.map((o) => (
              <div key={o.id} className="border-t py-3 space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />
                  {formatCardDate(o.transaction_date)}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-sm flex-1">{o.name}</span>
                  <span className="text-red-500 font-extrabold">
                    {o.amount}
                  </span>
                  <Badge
                    variant={
                      o.entry_type === "purchase" ? "default" : "destructive"
                    }
                    className="text-[11px]"
                  >
                    {o.entry_type === "purchase" ? "مشتريات" : "مصروفات"}
                  </Badge>
                </div>
                {o.notes && (
                  <p className="text-xs text-blue-600">📝 {o.notes}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* الوارد */}
        <Card>
          <CardContent className="p-4">
            <h2 className="text-muted-foreground font-bold mb-3">الوارد</h2>

            {filteredCashIn.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                لا توجد بيانات
              </p>
            )}

            {filteredCashIn.map((i) => (
              <div key={i.id} className="border-t py-3 space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />
                  {formatCardDate(i.transaction_date)}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-sm flex-1">
                    {i.customer_name}
                  </span>
                  <span className="text-green-500 font-extrabold">
                    {i.source_type === "invoice" ? i.paid_amount : i.amount}
                  </span>
                  <Badge
                    className="text-[11px]"
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
                  <p className="text-xs text-blue-600">📝 {i.notes}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
