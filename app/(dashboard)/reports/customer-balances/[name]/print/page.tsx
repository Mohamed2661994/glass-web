"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import api from "@/services/api";
import { calculateNetCustomerDebt } from "@/lib/customer-balance";
import { noSpaces, normalizeArabic } from "@/lib/utils";

/* ========== Types ========== */
type Invoice = {
  record_type: "invoice" | "payment";
  invoice_id: number;
  invoice_date: string;
  subtotal: number;
  discount_total: number;
  total: number;
  paid_amount: number;
  remaining_amount: number;
  previous_balance?: number;
  additional_amount?: number;
};

/* ========== Helpers ========== */
const formatMoney = (n: number) => Number(n).toFixed(2);

const parseAmountParam = (value: string | null) => {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatArabicDate = (value?: string, includeWeekday = false) => {
  if (!value) return "—";

  const normalized =
    value.length >= 10 ? `${value.substring(0, 10)}T00:00:00` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;

  const formatter = new Intl.DateTimeFormat("ar-EG-u-nu-arab", {
    weekday: includeWeekday ? "long" : undefined,
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });

  return formatter.format(date).replace("، ", " - ");
};

/* ========== Inner Component ========== */
function CustomerStatementPrintInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const customerName = decodeURIComponent(params.name as string);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const warehouseId = searchParams.get("warehouse_id");
  const manualOpeningBalance = parseAmountParam(
    searchParams.get("opening_balance"),
  );
  const isRetailBranch = warehouseId === "1";

  const [data, setData] = useState<Invoice[]>([]);
  const [cashInDateById, setCashInDateById] = useState<Record<string, string>>(
    {},
  );
  const [cashInDateByNumber, setCashInDateByNumber] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);

  /* ========== Fetch ========== */
  const fetchDetails = useCallback(async () => {
    try {
      setLoading(true);
      const [detailsRes, cashInRes, invoicesRes] = await Promise.all([
        api.get("/reports/customer-debt-details", {
          params: {
            customer_name: customerName,
            warehouse_id: warehouseId || undefined,
          },
        }),
        api.get("/cash-in", {
          params: {
            branch_id: warehouseId || undefined,
            limit: 100000,
          },
        }),
        api.get("/invoices", {
          params: {
            customer_name: customerName,
            invoice_type: warehouseId === "1" ? "retail" : "wholesale",
            limit: 10000,
          },
        }),
      ]);

      const debtRows: Invoice[] = detailsRes.data || [];
      const existingInvoiceIds = new Set(
        debtRows
          .filter((row) => row.record_type === "invoice")
          .map((row) => row.invoice_id),
      );

      const allInvoices: any[] = Array.isArray(invoicesRes.data)
        ? invoicesRes.data
        : (invoicesRes.data?.data ?? []);

      const invoiceSourceById = new Map(
        allInvoices
          .filter((invoice: any) => invoice?.id != null)
          .map((invoice: any) => [Number(invoice.id), invoice]),
      );

      const enrichedDebtRows: Invoice[] = debtRows.map((row) => {
        if (row.record_type !== "invoice") return row;

        const source = invoiceSourceById.get(Number(row.invoice_id));
        if (!source) return row;

        return {
          ...row,
          subtotal: Number(source.subtotal ?? row.subtotal ?? source.total ?? 0),
          discount_total: Number(
            source.discount_total ?? row.discount_total ?? source.extra_discount ?? 0,
          ),
          total: Number(source.total ?? row.total ?? 0),
          paid_amount: Number(source.paid_amount ?? row.paid_amount ?? 0),
          remaining_amount: Number(
            source.remaining_amount ?? row.remaining_amount ?? 0,
          ),
          previous_balance: Number(source.previous_balance ?? 0),
          additional_amount: Number(source.additional_amount ?? 0),
        };
      });

      const missingInvoices: Invoice[] = allInvoices
        .filter(
          (invoice: any) =>
            invoice.id &&
            !existingInvoiceIds.has(invoice.id) &&
            invoice.movement_type === "sale" &&
            Number(invoice.remaining_amount || 0) !== 0,
        )
        .map((invoice: any) => ({
          record_type: "invoice" as const,
          invoice_id: invoice.id,
          invoice_date: invoice.invoice_date || invoice.created_at || "",
          subtotal: Number(invoice.subtotal || invoice.total || 0),
          discount_total: Number(invoice.discount_total || 0),
          total: Number(invoice.total || 0),
          paid_amount: Number(invoice.paid_amount || 0),
          remaining_amount: Number(invoice.remaining_amount || 0),
          previous_balance: Number(invoice.previous_balance || 0),
          additional_amount: Number(invoice.additional_amount || 0),
        }));

      const allData = [...enrichedDebtRows, ...missingInvoices];
      allData.sort((left, right) => {
        const leftDate = left.invoice_date || "";
        const rightDate = right.invoice_date || "";
        return leftDate.localeCompare(rightDate);
      });

      setData(allData);
      const cashInRows = cashInRes.data?.data || cashInRes.data || [];
      const byId: Record<string, string> = {};
      const byNumber: Record<string, string> = {};
      const targetName = normalizeArabic(
        noSpaces(customerName || "").toLowerCase(),
      );
      cashInRows.forEach((row: any) => {
        if (!row || !row.transaction_date) return;
        const rowName = normalizeArabic(
          noSpaces(row.customer_name || "").toLowerCase(),
        );
        if (rowName !== targetName) return;
        if (row.id != null) {
          byId[String(row.id)] = row.transaction_date;
        }
        if (row.cash_in_number != null) {
          byNumber[String(row.cash_in_number)] = row.transaction_date;
        }
      });
      setCashInDateById(byId);
      setCashInDateByNumber(byNumber);
    } catch {
      setData([]);
      setCashInDateById({});
      setCashInDateByNumber({});
    } finally {
      setLoading(false);
    }
  }, [customerName, from, to, warehouseId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  /* ========== Auto-print ========== */
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => window.print(), 600);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  const getRowDate = useCallback(
    (row: Invoice) => {
      if (row.record_type === "invoice") return row.invoice_date;
      const key = String(row.invoice_id);
      return (
        cashInDateById[key] ||
        cashInDateByNumber[key] ||
        (row as any).transaction_date ||
        (row as any).record_date ||
        row.invoice_date
      );
    },
    [cashInDateById, cashInDateByNumber],
  );

  const visibleData = useMemo(() => {
    let rows = [...data];

    rows.sort((left, right) => {
      const leftDate = getRowDate(left) || "";
      const rightDate = getRowDate(right) || "";
      return leftDate.localeCompare(rightDate);
    });

    if (from || to) {
      rows = rows.filter((row) => {
        const dateStr = (getRowDate(row) || "").substring(0, 10);
        if (!dateStr) return false;
        if (from && dateStr < from) return false;
        if (to && dateStr > to) return false;
        return true;
      });
    }

    return rows;
  }, [data, from, to, getRowDate]);

  /* ========== Totals ========== */
  const totalInvoices = useMemo(
    () =>
      visibleData
        .filter((i) => i.record_type === "invoice")
        .reduce((s, i) => s + Number(i.subtotal), 0),
    [visibleData],
  );

  const totalDiscount = useMemo(
    () =>
      visibleData
        .filter((i) => i.record_type === "invoice")
        .reduce((s, i) => s + Number(i.discount_total), 0),
    [visibleData],
  );

  const totalPaid = useMemo(
    () => visibleData.reduce((s, i) => s + Number(i.paid_amount), 0),
    [visibleData],
  );

  const openingBalance = useMemo(() => {
    if (!from) return 0;

    const rows = [...data];
    rows.sort((left, right) => {
      const leftDate = getRowDate(left) || "";
      const rightDate = getRowDate(right) || "";
      return leftDate.localeCompare(rightDate);
    });

    const previousRows = rows.filter((row) => {
      const dateStr = (getRowDate(row) || "").substring(0, 10);
      return Boolean(dateStr) && dateStr < from;
    });

    return calculateNetCustomerDebt(previousRows) ?? 0;
  }, [data, from, getRowDate]);

  const netDebt = useMemo(() => {
    return calculateNetCustomerDebt(
      visibleData,
      openingBalance + manualOpeningBalance,
    ) ?? 0;
  }, [manualOpeningBalance, openingBalance, visibleData]);

  const dateRange =
    from || to
      ? `${from ? formatArabicDate(from) : "--"} — ${to ? formatArabicDate(to) : "---"}`
      : "-- ---";

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontSize: 18 }}>
        جاري تحميل بيانات كشف الحساب...
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      style={{
        background: "#fff",
        color: "#000",
        minHeight: "100vh",
        colorScheme: "light",
        fontFamily: "Arial, sans-serif",
        padding: "10px",
      }}
    >
      <div
        style={{
          maxWidth: 750,
          margin: "0 auto",
          padding: "10px 10px",
        }}
      >
        {/* Header */}
        <h1
          style={{
            textAlign: "center",
            fontSize: 24,
            fontWeight: "bold",
            marginBottom: 16,
          }}
        >
          كشف حساب عميل
        </h1>

        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 14, marginBottom: 4 }}>
            <span style={{ fontWeight: "bold" }}>اسم العميل:</span>{" "}
            <span style={{ fontSize: 18, fontWeight: "bold" }}>
              {customerName}
            </span>
          </p>
          <p style={{ fontSize: 14 }}>
            <span style={{ fontWeight: "bold" }}>الفترة:</span> {dateRange}
          </p>
          {manualOpeningBalance > 0 && (
            <p style={{ fontSize: 14, marginTop: 4 }}>
              <span style={{ fontWeight: "bold" }}>رصيد أول المدة:</span>{" "}
              {formatMoney(manualOpeningBalance)}
            </p>
          )}
        </div>

        {/* Table */}
        {visibleData.length > 0 ? (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
              marginBottom: 20,
            }}
          >
            <thead>
              <tr style={{ background: "#e5e5e5" }}>
                <th style={thStyle}>النوع</th>
                <th style={thStyle}>رقم</th>
                <th style={thStyle}>التاريخ</th>
                <th style={thStyle}>الحساب السابق</th>
                <th style={thStyle}>إضافة</th>
                <th style={thStyle}>الإجمالي</th>
                {!isRetailBranch && <th style={thStyle}>الخصم</th>}
                <th style={thStyle}>المدفوع</th>
                <th style={thStyle}>الباقي</th>
              </tr>
            </thead>
            <tbody>
              {visibleData.map((inv, idx) => (
                <tr
                  key={`${inv.record_type}-${inv.invoice_id}-${idx}`}
                  style={{
                    background:
                      inv.record_type === "payment" ? "#f0fdf4" : "#fefce8",
                  }}
                >
                  <td style={tdStyle}>
                    {inv.record_type === "invoice" ? "فاتورة" : "سند دفع"}
                  </td>
                  <td style={tdStyle}>{inv.invoice_id}</td>
                  <td style={tdStyle}>
                    {formatArabicDate(getRowDate(inv), true)}
                  </td>
                  <td style={tdStyle}>
                    {inv.record_type === "invoice"
                      ? Number(inv.previous_balance || 0) === 0
                        ? "—"
                        : formatMoney(Number(inv.previous_balance))
                      : "—"}
                  </td>
                  <td style={tdStyle}>
                    {inv.record_type === "invoice"
                      ? Number(inv.additional_amount || 0) === 0
                        ? "—"
                        : formatMoney(Number(inv.additional_amount))
                      : "—"}
                  </td>
                  <td style={tdStyle}>
                    {inv.record_type === "invoice"
                      ? formatMoney(Number(inv.subtotal))
                      : "—"}
                  </td>
                  {!isRetailBranch && (
                    <td style={tdStyle}>
                      {inv.record_type === "invoice" &&
                      Number(inv.discount_total) > 0
                        ? formatMoney(Number(inv.discount_total))
                        : "—"}
                    </td>
                  )}
                  <td style={tdStyle}>
                    {formatMoney(Number(inv.paid_amount))}
                  </td>
                  <td style={tdStyle}>
                    {inv.record_type === "invoice"
                      ? formatMoney(Number(inv.remaining_amount))
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ textAlign: "center", padding: "40px 0", color: "#888" }}>
            لا توجد بيانات لهذا العميل
          </p>
        )}

        {/* Summary */}
        {visibleData.length > 0 && (
          <div style={{ textAlign: "right", fontSize: 14 }}>
            {openingBalance > 0 && (
              <p style={{ marginBottom: 4 }}>
                <span style={{ fontWeight: "bold" }}>رصيد سابق مُرحَّل:</span>{" "}
                {formatMoney(openingBalance)}
              </p>
            )}
            <p style={{ marginBottom: 4 }}>
              <span style={{ fontWeight: "bold" }}>إجمالي الفواتير:</span>{" "}
              {formatMoney(totalInvoices)}
            </p>
            {!isRetailBranch && totalDiscount > 0 && (
              <p style={{ marginBottom: 4 }}>
                <span style={{ fontWeight: "bold" }}>إجمالي الخصم:</span>{" "}
                {formatMoney(totalDiscount)}
              </p>
            )}
            <p style={{ marginBottom: 4 }}>
              <span style={{ fontWeight: "bold" }}>إجمالي المدفوع:</span>{" "}
              {formatMoney(totalPaid)}
            </p>
            <p
              style={{
                fontSize: 18,
                fontWeight: "bold",
                marginTop: 8,
                color:
                  netDebt > 0 ? "#dc2626" : netDebt < 0 ? "#16a34a" : "#000",
              }}
            >
              صافي المديونية: {formatMoney(netDebt)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ========== Shared cell styles ========== */
const thStyle: React.CSSProperties = {
  border: "1px solid #000",
  padding: "6px 8px",
  textAlign: "center",
  fontWeight: "bold",
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #000",
  padding: "6px 8px",
  textAlign: "center",
};

/* ========== Page wrapper (Suspense for useSearchParams) ========== */
export default function CustomerStatementPrintPage() {
  return (
    <Suspense
      fallback={<div className="p-10 text-center text-lg">جاري التحميل...</div>}
    >
      <CustomerStatementPrintInner />
    </Suspense>
  );
}
