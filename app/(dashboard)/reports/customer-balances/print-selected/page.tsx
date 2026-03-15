"use client";

import { useEffect, useState } from "react";

/* ========== Types ========== */
type CustomerBalanceItem = {
  customer_name: string;
  total_sales: number;
  total_paid: number;
  balance_due: number;
  last_invoice_date?: string | null;
};

/* ========== Helpers ========== */
const formatMoney = (n: number) => Number(n).toLocaleString();

const formatTodayHeader = () => {
  const today = new Date();
  const weekday = new Intl.DateTimeFormat("ar-EG", {
    weekday: "long",
  }).format(today);

  return `${weekday} ${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
};

export default function PrintSelectedCustomersPage() {
  const [data, setData] = useState<CustomerBalanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const reportDate = formatTodayHeader();

  useEffect(() => {
    const stored = localStorage.getItem("printSelectedCustomers");
    if (stored) {
      try {
        setData(JSON.parse(stored));
      } catch {
        /* ignore */
      }
    }
    setLoading(false);
  }, []);

  /* Auto-print */
  useEffect(() => {
    if (!loading && data.length > 0) {
      const timer = setTimeout(() => window.print(), 600);
      return () => clearTimeout(timer);
    }
  }, [loading, data]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontSize: 18 }}>
        جاري التحميل...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div dir="rtl" style={{ padding: 40, textAlign: "center", fontSize: 18 }}>
        لا يوجد عملاء مختارين
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
        fontFamily: "Tahoma, Arial, sans-serif",
        padding: "0",
      }}
    >
      <style>{`
        @page {
          size: A4 landscape;
          margin: 8mm 10mm;
        }

        html, body {
          background: #fff;
        }

        * {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          box-sizing: border-box;
        }

        @media print {
          body {
            margin: 0;
          }
        }
      `}</style>

      <div style={sheetStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <h1 style={titleStyle}>
            حسابات السوق
          </h1>
          <div style={dateStyle}>{reportDate}</div>
        </div>

        {/* Table */}
        <table style={tableStyle}>
          <colgroup>
            <col style={{ width: "11%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "21%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "17%" }} />
          </colgroup>
          <thead>
            <tr style={theadRowStyle}>
              <th style={thBlank}>&nbsp;</th>
              <th style={thBlankExpanded}>&nbsp;</th>
              <th style={thCustomer}>اسم العميل</th>
              <th style={thDebt}>المديونية</th>
              <th style={thCompact}>فرق خصم</th>
              <th style={thCompact}>المدفوع</th>
              <th style={thRemaining}>المتبقي</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, idx) => {
              const balanceDue = Number(item.balance_due || 0);

              return (
                <tr key={idx}>
                  <td style={tdStyle}>&nbsp;</td>
                  <td style={tdStyle}>&nbsp;</td>
                  <td style={tdCustomer}>{item.customer_name || ""}</td>
                  <td style={tdMoney}>
                    {balanceDue > 0 ? formatMoney(balanceDue) : ""}
                  </td>
                  <td style={tdStyle}>&nbsp;</td>
                  <td style={tdStyle}>&nbsp;</td>
                  <td style={tdStyle}>&nbsp;</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ========== Shared cell styles ========== */
const thBase: React.CSSProperties = {
  border: "1px solid #7f8a98",
  padding: "8px 6px",
  textAlign: "center",
  fontWeight: "bold",
  whiteSpace: "nowrap",
  fontSize: 15,
  lineHeight: 1.1,
  background: "#e6ebf2",
  height: 32,
};

const sheetStyle: React.CSSProperties = {
  width: "277mm",
  margin: "7mm auto 0",
};

const headerStyle: React.CSSProperties = {
  background: "#4766a6",
  color: "#fff",
  padding: "14px 12px 12px",
  textAlign: "center",
  border: "1px solid #4766a6",
  borderBottom: "none",
};

const titleStyle: React.CSSProperties = {
  fontSize: 27,
  fontWeight: 700,
  margin: 0,
  lineHeight: 1.2,
};

const dateStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  marginTop: 6,
  lineHeight: 1.2,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  tableLayout: "fixed",
  border: "1px solid #7f8a98",
};

const theadRowStyle: React.CSSProperties = {
  background: "#e6ebf2",
};

const thBlank: React.CSSProperties = {
  ...thBase,
};

const thBlankExpanded: React.CSSProperties = {
  ...thBase,
};

const thCustomer: React.CSSProperties = {
  ...thBase,
};

const thDebt: React.CSSProperties = {
  ...thBase,
};

const thCompact: React.CSSProperties = {
  ...thBase,
};

const thRemaining: React.CSSProperties = {
  ...thBase,
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #b0b7c0",
  padding: "7px 6px",
  textAlign: "center",
  fontSize: 15,
  lineHeight: 1.1,
  height: 30,
  verticalAlign: "middle",
};

const tdCustomer: React.CSSProperties = {
  ...tdStyle,
  fontWeight: "bold",
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  fontSize: 16,
};

const tdMoney: React.CSSProperties = {
  ...tdStyle,
  whiteSpace: "nowrap",
  fontSize: 16,
};
