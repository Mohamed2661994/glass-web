"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "@/services/api";
import { useAuth } from "@/app/context/auth-context";
import { useRealtime } from "@/hooks/use-realtime";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExportButtons, type ExportColumn } from "@/components/export-buttons";
import { Search } from "lucide-react";

type SalesProfitRow = {
  invoice_id: number;
  branch_id: number;
  invoice_type: "retail" | "wholesale";
  invoice_date: string;
  customer_name: string;
  items_total_after_discount: number;
  total_cost: number;
  net_profit: number;
};

type InvoiceTypeFilter = "all" | "retail" | "wholesale";

const formatMoney = (value: number) =>
  Math.round(Number(value || 0)).toLocaleString("en-US");

const getProfitPercentage = (salesTotal: number, netProfit: number) => {
  const total = Number(salesTotal || 0);
  if (total === 0) return 0;
  return (Number(netProfit || 0) / total) * 100;
};

const formatPercent = (value: number) => `${Number(value || 0).toFixed(2)}%`;

const formatDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ar-EG");
};

const invoiceTypeLabel = (invoiceType: "retail" | "wholesale") =>
  invoiceType === "retail" ? "قطاعي" : "جملة";

export default function InvoiceSalesProfitPage() {
  const { user } = useAuth();
  const isShowroomUser = user?.branch_id === 1;
  const isWarehouseUser = user?.branch_id === 2;

  const [rows, setRows] = useState<SalesProfitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [invoiceType, setInvoiceType] = useState<InvoiceTypeFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [branchFilter, setBranchFilter] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    if (user.branch_id === 1) {
      setBranchFilter("1");
      setInvoiceType("retail");
      return;
    }
    if (user.branch_id === 2) {
      setBranchFilter("2");
      setInvoiceType("wholesale");
      return;
    }
    setInvoiceType("all");
    setBranchFilter(null);
  }, [user]);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = {};

      if (branchFilter) params.branch_id = branchFilter;
      if (invoiceType !== "all") params.invoice_type = invoiceType;
      if (searchText.trim()) params.customer_name = searchText.trim();
      if (fromDate) params.date_from = fromDate;
      if (toDate) params.date_to = toDate;

      const res = await api.get("/reports/invoice-sales-profit", { params });
      setRows(Array.isArray(res.data) ? (res.data as SalesProfitRow[]) : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [branchFilter, invoiceType, searchText, fromDate, toDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  useRealtime(["data:invoices", "data:products"], fetchReport);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.sales += Number(row.items_total_after_discount || 0);
        acc.profit += Number(row.net_profit || 0);
        return acc;
      },
      { sales: 0, profit: 0 },
    );
  }, [rows]);

  const exportColumns: ExportColumn[] = [
    { header: "رقم الفاتورة", key: "invoice_id", width: 14 },
    { header: "التاريخ", key: "invoice_date_formatted", width: 16 },
    { header: "العميل", key: "customer_name", width: 24 },
    { header: "نوع الفاتورة", key: "invoice_type_label", width: 14 },
    {
      header: "إجمالي بعد الخصم",
      key: "items_total_after_discount",
      width: 18,
    },
    { header: "صافي الربح", key: "net_profit", width: 14 },
    { header: "نسبة الربح %", key: "profit_percentage", width: 14 },
  ];

  const exportData = rows.map((row) => ({
    ...row,
    invoice_date_formatted: formatDate(row.invoice_date),
    invoice_type_label: invoiceTypeLabel(row.invoice_type),
    items_total_after_discount: Number(row.items_total_after_discount || 0),
    net_profit: Number(row.net_profit || 0),
    profit_percentage: Number(
      getProfitPercentage(
        row.items_total_after_discount,
        row.net_profit,
      ).toFixed(2),
    ),
  }));

  const branchOptions =
    !isShowroomUser && !isWarehouseUser
      ? [
          { label: "الكل", value: null },
          { label: "المخزن الرئيسي", value: "2" },
          { label: "مخزن المعرض", value: "1" },
        ]
      : [];

  return (
    <PageContainer size="xl">
      <div dir="rtl" className="space-y-4 py-6">
        <h1 className="text-2xl font-bold text-center">
          تقرير ربحية المبيعات حسب الفواتير
        </h1>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-end justify-center">
              {branchOptions.length > 0 && (
                <div className="flex gap-2">
                  {branchOptions.map((option) => (
                    <Button
                      key={option.label}
                      variant={
                        branchFilter === option.value ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => setBranchFilter(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              )}

              <div className="relative w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث باسم العميل..."
                  className="pr-9"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>

              {isShowroomUser || isWarehouseUser ? (
                <Button variant="outline" size="sm" className="cursor-default">
                  {`نوع الفاتورة: ${invoiceTypeLabel(invoiceType as "retail" | "wholesale")}`}
                </Button>
              ) : (
                <Select
                  value={invoiceType}
                  onValueChange={(value) =>
                    setInvoiceType(value as InvoiceTypeFilter)
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="نوع الفاتورة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الأنواع</SelectItem>
                    <SelectItem value="retail">قطاعي</SelectItem>
                    <SelectItem value="wholesale">جملة</SelectItem>
                  </SelectContent>
                </Select>
              )}

              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-40"
              />

              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-40"
              />

              <Button variant="outline" size="sm" onClick={fetchReport}>
                تحديث
              </Button>
            </div>
          </CardContent>
        </Card>

        {!loading && rows.length > 0 && (
          <div className="flex justify-center">
            <ExportButtons
              tableRef={tableRef}
              columns={exportColumns}
              data={exportData}
              filename={`ربحية-المبيعات-${new Date().toISOString().slice(0, 10)}`}
              title="تقرير ربحية المبيعات حسب الفواتير"
              pdfOrientation="landscape"
            />
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-sm text-muted-foreground">
                  عدد الفواتير
                </div>
                <div className="text-xl font-bold mt-1">
                  {formatMoney(rows.length)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-sm text-muted-foreground">
                  إجمالي بعد الخصم
                </div>
                <div className="text-xl font-bold mt-1">
                  {formatMoney(totals.sales)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-sm text-muted-foreground">
                  إجمالي صافي الربح
                </div>
                <div
                  className={`text-xl font-bold mt-1 ${totals.profit >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {formatMoney(totals.profit)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto" ref={tableRef}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">رقم الفاتورة</TableHead>
                    <TableHead className="text-center">التاريخ</TableHead>
                    <TableHead className="text-right">العميل</TableHead>
                    <TableHead className="text-center">النوع</TableHead>
                    <TableHead className="text-center">
                      إجمالي بعد الخصم
                    </TableHead>
                    <TableHead className="text-center">صافي الربح</TableHead>
                    <TableHead className="text-center">نسبة الربح %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10">
                        جاري التحميل...
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-10 text-muted-foreground"
                      >
                        لا توجد بيانات
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.invoice_id}>
                        <TableCell className="text-center font-medium">
                          {row.invoice_id}
                        </TableCell>
                        <TableCell className="text-center">
                          {formatDate(row.invoice_date)}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.customer_name || "عميل نقدي"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">
                            {invoiceTypeLabel(row.invoice_type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {formatMoney(row.items_total_after_discount)}
                        </TableCell>
                        <TableCell
                          className={`text-center font-bold ${row.net_profit >= 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          {formatMoney(row.net_profit)}
                        </TableCell>
                        <TableCell
                          className={`text-center font-bold ${row.net_profit >= 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          {formatPercent(
                            getProfitPercentage(
                              row.items_total_after_discount,
                              row.net_profit,
                            ),
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {!loading && rows.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4} className="text-center font-bold">
                        الإجماليات
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        {formatMoney(totals.sales)}
                      </TableCell>
                      <TableCell
                        className={`text-center font-bold ${totals.profit >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {formatMoney(totals.profit)}
                      </TableCell>
                      <TableCell
                        className={`text-center font-bold ${totals.profit >= 0 ? "text-green-600" : "text-red-600"}`}
                      >
                        {formatPercent(
                          getProfitPercentage(totals.sales, totals.profit),
                        )}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
