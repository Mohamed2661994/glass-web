"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";

/* ========== Types ========== */
type CustomerBalanceItem = {
  customer_name: string;
  total_sales: number;
  total_paid: number;
  balance_due: number;
  last_invoice_date?: string | null;
};

/* ========== Component ========== */
export default function CustomerBalancesPage() {
  const { user } = useAuth();
  const isShowroomUser = user?.branch_id === 1;
  const isWarehouseUser = user?.branch_id === 2;

  const [data, setData] = useState<CustomerBalanceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(
    new Set(),
  );
  const router = useRouter();

  /* invoice_type حسب الفرع */
  const invoiceType = isShowroomUser
    ? "retail"
    : isWarehouseUser
      ? "wholesale"
      : undefined;

  /* ========== Fetch ========== */
  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);

      // 1) جلب تقرير المديونية
      const balancesRes = await api.get("/reports/customer-balances", {
        params: {
          customer_name: customerSearch || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        },
      });
      let balances: CustomerBalanceItem[] = Array.isArray(balancesRes.data)
        ? balancesRes.data
        : [];

      // 2) فلتر حسب نوع الفاتورة (قطاعي/جملة) عن طريق جلب الفواتير
      if (invoiceType) {
        const invoicesRes = await api.get("/invoices", {
          params: {
            invoice_type: invoiceType,
            limit: 9999,
          },
        });
        const invoices: { customer_name: string }[] = Array.isArray(
          invoicesRes.data,
        )
          ? invoicesRes.data
          : [];

        // جمع أسماء العملاء اللي ليهم فواتير من النوع ده
        const validCustomers = new Set(
          invoices
            .map((inv) => (inv.customer_name || "").trim())
            .filter(Boolean),
        );

        // فلتر المديونية لتشمل العملاء دول بس
        balances = balances.filter((c) =>
          validCustomers.has((c.customer_name || "").trim()),
        );
      }

      setData(balances);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [customerSearch, fromDate, toDate, invoiceType]);

  /* Auto-search */
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchReport();
    }, 400);
    return () => clearTimeout(timer);
  }, [fetchReport]);

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
            </div>
          </CardContent>
        </Card>

        {/* Print selected button */}
        {selectedCustomers.size > 0 && (
          <div className="flex justify-center">
            <Button onClick={handlePrintSelected} className="gap-2">
              <Printer className="h-4 w-4" />
              طباعة تقرير العملاء المختارين ({selectedCustomers.size})
            </Button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Table */}
        {!loading && data.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
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
                        <TableCell className="text-right font-medium">
                          <Link
                            href={`/reports/customer-balances/${encodeURIComponent(item.customer_name)}`}
                            className="text-primary hover:underline"
                          >
                            {item.customer_name}
                          </Link>
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
