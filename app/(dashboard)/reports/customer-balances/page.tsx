"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "@/services/api";
import { useAuth } from "@/app/context/auth-context";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Printer, Search } from "lucide-react";
import { ExportButtons, type ExportColumn } from "@/components/export-buttons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { useRealtime } from "@/hooks/use-realtime";
import { Skeleton } from "@/components/ui/skeleton";
import { noSpaces, normalizeArabic } from "@/lib/utils";

/* ========== Types ========== */
type CustomerBalanceItem = {
  customer_name: string;
  total_sales: number;
  total_paid: number;
  balance_due: number;
  last_invoice_date?: string | null;
  is_market_customer?: boolean;
};

type CustomerItem = {
  name: string;
  is_market_customer?: boolean;
};

const getCustomerLookupKey = (value: string) =>
  normalizeArabic(noSpaces(value || "").toLowerCase());

/* ========== Component ========== */
export default function CustomerBalancesPage() {
  const { user } = useAuth();

  const [data, setData] = useState<CustomerBalanceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showAllCustomers, setShowAllCustomers] = useState(false);
  const [showMarketCustomersOnly, setShowMarketCustomersOnly] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(
    new Set(),
  );
  const router = useRouter();
  const tableRef = useRef<HTMLDivElement>(null);

  /* ========== Fetch ========== */
  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);

      const customersParams: Record<string, string> = {};
      if (customerSearch.trim().length >= 2) {
        customersParams.search = customerSearch.trim();
      }
      if (showMarketCustomersOnly) {
        customersParams.market_only = "1";
      }

      // جلب تقرير المديونية مع فلترة server-side حسب الفرع
      const [balancesRes, customersRes] = await Promise.all([
        api.get("/reports/customer-balances", {
          params: {
            customer_name: customerSearch || undefined,
            from: fromDate || undefined,
            to: toDate || undefined,
            warehouse_id: user?.branch_id || undefined,
          },
        }),
        api.get("/customers", { params: customersParams }),
      ]);

      let balances: CustomerBalanceItem[] = Array.isArray(balancesRes.data)
        ? balancesRes.data
        : [];

      const customers: CustomerItem[] = Array.isArray(customersRes.data)
        ? customersRes.data
        : [];
      const marketLookup = new Map(
        customers.map((customer) => [
          getCustomerLookupKey(customer.name),
          Boolean(customer.is_market_customer),
        ]),
      );

      balances = balances.map((item) => ({
        ...item,
        total_sales: Number(item.total_sales || 0),
        total_paid: Number(item.total_paid || 0),
        balance_due: Number(item.balance_due || 0),
        is_market_customer:
          marketLookup.get(getCustomerLookupKey(item.customer_name)) ?? false,
      }));

      // تصحيح أرقام كل عميل من بيانات كشف الحساب الفعلية (نفس أسلوب صفحة التفاصيل)
      const invoiceType = user?.branch_id === 1 ? "retail" : "wholesale";
      const corrected = await Promise.all(
        balances.map(async (item) => {
          try {
            const [detailsRes, invoicesRes] = await Promise.all([
              api.get("/reports/customer-debt-details", {
                params: {
                  customer_name: item.customer_name,
                  warehouse_id: user?.branch_id || undefined,
                },
              }),
              api.get("/invoices", {
                params: {
                  customer_name: item.customer_name,
                  invoice_type: invoiceType,
                  limit: 10000,
                },
              }),
            ]);

            const debtRows: any[] = detailsRes.data || [];
            const allInvoices: any[] = Array.isArray(invoicesRes.data)
              ? invoicesRes.data
              : (invoicesRes.data?.data ?? []);

            // دمج الفواتير الناقصة (مثل حالة تغيير اسم العميل)
            const existingIds = new Set(
              debtRows
                .filter((r: any) => r.record_type === "invoice")
                .map((r: any) => r.invoice_id),
            );
            const missing = allInvoices
              .filter(
                (inv: any) =>
                  inv.id &&
                  !existingIds.has(inv.id) &&
                  inv.movement_type === "sale",
              )
              .map((inv: any) => ({
                record_type: "invoice" as const,
                invoice_id: inv.id,
                invoice_date: inv.invoice_date || inv.created_at || "",
                total: Number(inv.total || 0),
                paid_amount: Number(inv.paid_amount || 0),
              }));

            const allRows = [...debtRows, ...missing];

            let totalSales = 0;
            let debt = 0;
            let lastDate: string | null = null;

            for (const row of allRows) {
              if (row.record_type === "invoice") {
                const t = Number(row.total || 0);
                const p = Number(row.paid_amount || 0);
                totalSales += t;
                debt += t - p;
                const d = (
                  row.invoice_date ||
                  row.created_at ||
                  ""
                ).substring(0, 10);
                if (d && (!lastDate || d > lastDate)) lastDate = d;
              } else {
                debt -= Number(row.paid_amount || 0);
              }
            }

            return {
              ...item,
              total_sales: totalSales,
              total_paid: totalSales - debt,
              balance_due: debt,
              last_invoice_date: lastDate || item.last_invoice_date,
            };
          } catch {
            return item;
          }
        }),
      );
      balances = corrected;

      if (showAllCustomers) {
        const byName = new Map<string, CustomerBalanceItem>();
        for (const item of balances) {
          byName.set(item.customer_name, {
            customer_name: item.customer_name,
            total_sales: Number(item.total_sales || 0),
            total_paid: Number(item.total_paid || 0),
            balance_due: Number(item.balance_due || 0),
            last_invoice_date: item.last_invoice_date || null,
            is_market_customer: Boolean(item.is_market_customer),
          });
        }

        for (const c of customers) {
          if (!byName.has(c.name)) {
            byName.set(c.name, {
              customer_name: c.name,
              total_sales: 0,
              total_paid: 0,
              balance_due: 0,
              last_invoice_date: null,
              is_market_customer: Boolean(c.is_market_customer),
            });
          }
        }

        balances = Array.from(byName.values()).sort((a, b) => {
          const diff = Number(b.balance_due || 0) - Number(a.balance_due || 0);
          if (diff !== 0) return diff;
          return a.customer_name.localeCompare(b.customer_name, "ar");
        });
      }

      if (showMarketCustomersOnly) {
        balances = balances.filter((item) => Boolean(item.is_market_customer));
      }

      setData(balances);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [
    customerSearch,
    fromDate,
    toDate,
    user?.branch_id,
    showAllCustomers,
    showMarketCustomersOnly,
  ]);

  /* Auto-search */
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchReport();
    }, 400);
    return () => clearTimeout(timer);
  }, [fetchReport]);

  useEffect(() => {
    setSelectedCustomers((prev) => {
      const visibleCustomers = new Set(data.map((item) => item.customer_name));
      const next = new Set(
        [...prev].filter((name) => visibleCustomers.has(name)),
      );
      return next.size === prev.size ? prev : next;
    });
  }, [data]);

  useRealtime(
    ["data:invoices", "data:cash", "data:cash-in", "data:customers"],
    fetchReport,
  );

  /* ========== Totals ========== */
  const totalBalance = useMemo(
    () => data.reduce((sum, c) => sum + Number(c.balance_due || 0), 0),
    [data],
  );

  /* ========== Clear filters ========== */
  const clearFilters = () => {
    setCustomerSearch("");
    setFromDate("");
    setToDate("");
  };

  const hasFilters = customerSearch || fromDate || toDate;

  /* ========== Export columns ========== */
  const exportColumns: ExportColumn[] = [
    { header: "العميل", key: "customer_name", width: 25 },
    { header: "آخر فاتورة", key: "last_invoice_date_formatted", width: 16 },
    { header: "إجمالي المبيعات", key: "total_sales", width: 16 },
    { header: "المدفوع", key: "total_paid", width: 16 },
    { header: "المديونية", key: "balance_due", width: 16 },
  ];

  const exportData = data.map((item) => ({
    ...item,
    last_invoice_date_formatted: item.last_invoice_date
      ? new Date(item.last_invoice_date).toLocaleDateString("ar-EG")
      : "—",
    total_sales: Number(item.total_sales || 0),
    total_paid: Number(item.total_paid || 0),
    balance_due: Number(item.balance_due || 0),
  }));

  /* ========== Checkbox helpers ========== */
  const toggleCustomer = (name: string) => {
    setSelectedCustomers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedCustomers.size === data.length) {
      setSelectedCustomers(new Set());
    } else {
      setSelectedCustomers(new Set(data.map((c) => c.customer_name)));
    }
  };

  const handlePrintSelected = () => {
    const selected = data.filter((c) => selectedCustomers.has(c.customer_name));
    localStorage.setItem("printSelectedCustomers", JSON.stringify(selected));
    router.push("/reports/customer-balances/print-selected");
  };

  return (
    <PageContainer size="xl">
      <div dir="rtl" className="space-y-4 py-6">
        <h1 className="text-2xl font-bold text-center">
          تقرير مديونية العملاء
        </h1>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 space-y-3">
            {/* Search */}
            <div className="relative max-w-md mx-auto">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث باسم العميل..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="pr-9"
              />
            </div>

            {/* Date range */}
            <div className="flex flex-wrap gap-3 justify-center items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  من تاريخ
                </label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-44"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  إلى تاريخ
                </label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-44"
                />
              </div>
              {hasFilters && (
                <Button variant="destructive" size="sm" onClick={clearFilters}>
                  مسح الفلاتر
                </Button>
              )}
              <Button
                variant={showAllCustomers ? "default" : "outline"}
                size="sm"
                onClick={() => setShowAllCustomers((prev) => !prev)}
              >
                {showAllCustomers ? "عرض المديونين فقط" : "عرض جميع العملاء"}
              </Button>
              <Button
                variant={showMarketCustomersOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setShowMarketCustomersOnly((prev) => !prev)}
              >
                {showMarketCustomersOnly ? "عرض كل العملاء" : "عملاء السوق فقط"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Export & Print buttons */}
        <div className="flex justify-center gap-2 flex-wrap">
          {!loading && data.length > 0 && (
            <ExportButtons
              tableRef={tableRef}
              columns={exportColumns}
              data={exportData}
              filename={`مديونية-العملاء-${new Date().toISOString().slice(0, 10)}`}
              title="تقرير مديونية العملاء"
            />
          )}
          {selectedCustomers.size > 0 && (
            <Button onClick={handlePrintSelected} className="gap-2">
              <Printer className="h-4 w-4" />
              طباعة تقرير العملاء المختارين ({selectedCustomers.size})
            </Button>
          )}
        </div>

        {/* Loading Skeleton */}
        {loading && (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center w-10">
                      <Skeleton className="h-4 w-4 mx-auto" />
                    </TableHead>
                    <TableHead className="text-right">
                      <Skeleton className="h-4 w-20" />
                    </TableHead>
                    <TableHead className="text-center">
                      <Skeleton className="h-4 w-24 mx-auto" />
                    </TableHead>
                    <TableHead className="text-center">
                      <Skeleton className="h-4 w-24 mx-auto" />
                    </TableHead>
                    <TableHead className="text-center">
                      <Skeleton className="h-4 w-20 mx-auto" />
                    </TableHead>
                    <TableHead className="text-center">
                      <Skeleton className="h-4 w-20 mx-auto" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(8)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-center">
                        <Skeleton className="h-4 w-4 mx-auto" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell className="text-center">
                        <Skeleton className="h-4 w-24 mx-auto" />
                      </TableCell>
                      <TableCell className="text-center">
                        <Skeleton className="h-4 w-20 mx-auto" />
                      </TableCell>
                      <TableCell className="text-center">
                        <Skeleton className="h-4 w-20 mx-auto" />
                      </TableCell>
                      <TableCell className="text-center">
                        <Skeleton className="h-4 w-20 mx-auto" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Table - Desktop */}
        {!loading && data.length > 0 && (
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto" ref={tableRef}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center w-10">
                        <Checkbox
                          checked={
                            data.length > 0 &&
                            selectedCustomers.size === data.length
                          }
                          onCheckedChange={toggleAll}
                        />
                      </TableHead>
                      <TableHead className="text-right">العميل</TableHead>
                      <TableHead className="text-center">آخر فاتورة</TableHead>
                      <TableHead className="text-center">
                        إجمالي المبيعات
                      </TableHead>
                      <TableHead className="text-center">المدفوع</TableHead>
                      <TableHead className="text-center">المديونية</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={selectedCustomers.has(item.customer_name)}
                            onCheckedChange={() =>
                              toggleCustomer(item.customer_name)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap">
                          <Link
                            href={`/reports/customer-balances/${encodeURIComponent(item.customer_name)}`}
                            className="text-primary hover:underline inline align-middle"
                          >
                            {item.customer_name}
                          </Link>
                          {item.is_market_customer && (
                            <Badge
                              variant="secondary"
                              className="mr-2 align-middle"
                            >
                              سوق
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {item.last_invoice_date
                            ? new Date(
                                item.last_invoice_date,
                              ).toLocaleDateString("ar-EG")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {Number(item.total_sales || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          {Number(item.total_paid || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center font-bold text-red-600">
                          {Number(item.balance_due || 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mobile Cards */}
        {!loading && data.length > 0 && (
          <div className="md:hidden space-y-2">
            {data.map((item, idx) => (
              <Card key={idx} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedCustomers.has(item.customer_name)}
                      onCheckedChange={() => toggleCustomer(item.customer_name)}
                    />
                    <div>
                      <div className="whitespace-nowrap text-right">
                        <Link
                          href={`/reports/customer-balances/${encodeURIComponent(item.customer_name)}`}
                          className="text-primary font-medium hover:underline inline align-middle"
                        >
                          {item.customer_name}
                        </Link>
                        {item.is_market_customer && (
                          <Badge
                            variant="secondary"
                            className="mr-2 align-middle"
                          >
                            سوق
                          </Badge>
                        )}
                      </div>
                      {item.last_invoice_date && (
                        <p className="text-xs text-muted-foreground">
                          آخر فاتورة:{" "}
                          {new Date(item.last_invoice_date).toLocaleDateString(
                            "ar-EG",
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-bold text-red-600">
                      {Number(item.balance_due || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">مديونية</p>
                  </div>
                </div>
                <div className="flex justify-between mt-2 pt-2 border-t text-xs text-muted-foreground">
                  <span>
                    مبيعات: {Number(item.total_sales || 0).toLocaleString()}
                  </span>
                  <span>
                    مدفوع: {Number(item.total_paid || 0).toLocaleString()}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && data.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            لا توجد بيانات
          </div>
        )}

        {/* Summary */}
        {!loading && data.length > 0 && (
          <div className="flex justify-center gap-4">
            <Badge variant="secondary">{data.length} عميل</Badge>
            <Badge variant="destructive">
              إجمالي المديونية: {Math.round(totalBalance).toLocaleString()} جنيه
            </Badge>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
