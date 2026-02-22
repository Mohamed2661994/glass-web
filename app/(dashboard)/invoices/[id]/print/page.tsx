"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import api from "@/services/api";

interface InvoiceItem {
  product_id: number;
  product_name: string;
  package: string;
  price: number;
  quantity: number;
  discount: number;
  total: number;
  manufacturer: string;
  is_return?: boolean;
}

interface InvoiceData {
  id: number;
  invoice_type: "retail" | "wholesale";
  movement_type: "sale" | "purchase";
  invoice_date: string;
  customer_name: string;
  customer_phone: string;
  subtotal: number;
  items_discount: number;
  extra_discount: number;
  manual_discount: number;
  discount_total: number;
  total: number;
  previous_balance: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: string;
  apply_items_discount: boolean;
  items: InvoiceItem[];
}

type PaperSize = "A5" | "A4" | "A6";
type Orientation = "portrait" | "landscape";
type MarginSize = "normal" | "narrow" | "none";

const PAPER_DIMS: Record<PaperSize, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A5: { w: 148, h: 210 },
  A6: { w: 105, h: 148 },
};

const MARGIN_VALUES: Record<MarginSize, number> = {
  normal: 10,
  narrow: 5,
  none: 0,
};

const COLOR_PRESETS = [
  { label: "أسود", value: "#000000" },
  { label: "كحلي", value: "#1e3a5f" },
  { label: "أزرق", value: "#1d4ed8" },
  { label: "أخضر", value: "#15803d" },
  { label: "أحمر", value: "#dc2626" },
  { label: "بنفسجي", value: "#7c3aed" },
  { label: "بني", value: "#78350f" },
  { label: "رمادي", value: "#4b5563" },
];

export default function InvoicePrintPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <p>جاري التحميل...</p>
        </div>
      }
    >
      <InvoicePrintPage />
    </Suspense>
  );
}

function InvoicePrintPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const isPreview = searchParams.get("preview") === "1";
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ──── إعدادات الطباعة ──── */
  const [copies, setCopies] = useState(1);
  const [paperSize, setPaperSize] = useState<PaperSize>("A5");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [margins, setMargins] = useState<MarginSize>("normal");
  const [printBold, setPrintBold] = useState(false);
  const [printColor, setPrintColor] = useState("#000000");
  const [fontSize, setFontSize] = useState(10);
  const [showLogo, setShowLogo] = useState(true);
  const [showPhone, setShowPhone] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);

  /* ──── تحميل الإعدادات من localStorage ──── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("appSettings");
      if (raw) {
        const s = JSON.parse(raw);
        if (s.printBold !== undefined) setPrintBold(s.printBold);
        if (s.printColor) setPrintColor(s.printColor);
      }
    } catch {}
    try {
      const raw = localStorage.getItem("printSettings");
      if (raw) {
        const s = JSON.parse(raw);
        if (s.copies) setCopies(s.copies);
        if (s.paperSize) setPaperSize(s.paperSize);
        if (s.orientation) setOrientation(s.orientation);
        if (s.margins) setMargins(s.margins);
        if (s.fontSize) setFontSize(s.fontSize);
        if (s.showLogo !== undefined) setShowLogo(s.showLogo);
        if (s.showPhone !== undefined) setShowPhone(s.showPhone);
      }
    } catch {}
  }, []);

  /* ──── حفظ إعدادات الطباعة ──── */
  const savePrintSettings = useCallback(
    (patch: Record<string, unknown>) => {
      try {
        const raw = localStorage.getItem("printSettings");
        const prev = raw ? JSON.parse(raw) : {};
        const next = {
          ...prev,
          copies,
          paperSize,
          orientation,
          margins,
          fontSize,
          showLogo,
          showPhone,
          ...patch,
        };
        localStorage.setItem("printSettings", JSON.stringify(next));
      } catch {}
    },
    [copies, paperSize, orientation, margins, fontSize, showLogo, showPhone],
  );

  /* ──── تحميل الفاتورة ──── */
  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const res = await api.get(`/invoices/${id}/edit`);
        setInvoice(res.data);
      } catch {
        setError("فشل تحميل الفاتورة");
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchInvoice();
  }, [id]);

  /* ──── أبعاد الورقة الفعلية ──── */
  const paper = PAPER_DIMS[paperSize];
  const pageW = orientation === "portrait" ? paper.w : paper.h;
  const pageH = orientation === "portrait" ? paper.h : paper.w;
  const marginMM = MARGIN_VALUES[margins];

  /* ──── بناء HTML الطباعة ──── */
  const buildPrintHTML = useCallback(() => {
    if (!invoiceRef.current) return "";
    const html = invoiceRef.current.innerHTML;

    const css = `
      <style>
        body { margin:0; padding:0; background:white; font-family:Tahoma,Arial; direction:rtl; }
        * { color: ${printColor} !important; }
        .invoice-wrap {
          width:100%; margin:0; padding:${marginMM}mm; box-sizing:border-box;
          direction:rtl; font-size:${fontSize}px;
          ${printBold ? "font-weight:bold;" : ""}
          color:${printColor} !important;
        }
        .invoice-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
        .invoice-info { font-size:${fontSize}px; line-height:1.4; text-align:right; min-width:170px; }
        table { width:100%; border-collapse:collapse; font-size:${fontSize}px; }
        th { background:#f3f3f3; font-weight:bold; border-bottom:2px solid ${printColor}; }
        td { border-bottom:1px solid #ddd; }
        th,td { padding:3px 4px; text-align:center; }
        .totals-section {
          margin-top:4px; padding-top:4px; border-top:2px solid ${printColor};
          width:55%; margin-left:0; margin-right:auto;
          font-size:${fontSize + 1}px; line-height:1.5; text-align:left;
        }
        .totals-remaining { font-size:${fontSize + 3}px; }
        hr { border:none; border-top:2px solid #000; margin-bottom:10px; }
        @page { size:${pageW}mm ${pageH}mm; margin:${marginMM}mm; }
        table { page-break-inside:auto; break-inside:auto; }
        tr { page-break-inside:avoid; break-inside:avoid; }
        thead { display:table-header-group; }
        tfoot { display:table-row-group; }
        .totals-section { break-inside:avoid; }
      </style>
    `;

    let pages = "";
    for (let c = 0; c < copies; c++) {
      pages += `<div class="invoice-wrap" ${c > 0 ? 'style="page-break-before:always;"' : ""}>${html}</div>`;
    }
    return `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8">${css}</head><body>${pages}</body></html>`;
  }, [
    copies,
    paperSize,
    orientation,
    margins,
    printBold,
    printColor,
    fontSize,
    pageW,
    pageH,
    marginMM,
  ]);

  /* ──── طباعة عبر iframe مخفي ──── */
  const handlePrint = useCallback(() => {
    if (!invoiceRef.current || isPrinting) return;
    setIsPrinting(true);

    const fullHtml = buildPrintHTML();
    const iframe = iframeRef.current;
    if (!iframe || !fullHtml) {
      setIsPrinting(false);
      return;
    }

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      setIsPrinting(false);
      return;
    }

    let printed = false;

    doc.open();
    doc.write(fullHtml);
    doc.close();

    iframe.onload = () => {
      if (printed) return;
      printed = true;
      setTimeout(() => {
        try {
          iframe.contentWindow?.print();
        } catch {
          window.print();
        }
        setIsPrinting(false);
      }, 300);
    };

    // Fallback only if onload never fired
    setTimeout(() => {
      if (printed) return;
      printed = true;
      try {
        iframe.contentWindow?.print();
      } catch {}
      setIsPrinting(false);
    }, 2500);
  }, [isPrinting, buildPrintHTML]);

  /* ──── Auto-print ──── */
  useEffect(() => {
    if (invoice && !loading && !isPreview) {
      try {
        const raw = localStorage.getItem("appSettings");
        if (raw) {
          const s = JSON.parse(raw);
          if (s.autoPrint === false) return;
        }
      } catch {}
      setTimeout(() => handlePrint(), 600);
    }
  }, [invoice, loading, isPreview, handlePrint]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "Tahoma,Arial",
        }}
      >
        <p>جاري التحميل...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "Tahoma,Arial",
        }}
      >
        <p>{error || "الفاتورة غير موجودة"}</p>
      </div>
    );
  }

  /* ──────────── حسابات ──────────── */
  const items = invoice.items || [];
  const isWholesale = invoice.invoice_type === "wholesale";

  const calcUnitPrice = (it: InvoiceItem) =>
    isWholesale || invoice.apply_items_discount
      ? Number(it.price) - Number(it.discount || 0)
      : Number(it.price);

  const calcItemTotal = (it: InvoiceItem) =>
    calcUnitPrice(it) * Number(it.quantity || 0);

  const itemsSubtotal = items.reduce(
    (sum, it) =>
      it.is_return
        ? sum - Math.abs(calcItemTotal(it))
        : sum + calcItemTotal(it),
    0,
  );

  const extraDiscount = Number(
    invoice.manual_discount ?? invoice.extra_discount ?? 0,
  );
  const previousBalance = Number(invoice.previous_balance) || 0;
  const paidAmount = Number(invoice.paid_amount) || 0;
  const netTotal = itemsSubtotal + previousBalance - extraDiscount;
  const remaining = netTotal - paidAmount;

  const totalQty = items.reduce(
    (sum, it) => (it.is_return ? sum : sum + Number(it.quantity || 0)),
    0,
  );

  const formatPackage = (it: InvoiceItem) => {
    const raw = it.package ?? "";
    if (!raw) return "-";
    let text = String(raw).replace("كرتونة", "").trim();
    let match = text.match(/^([^\d]+)\s*(\d+)$/);
    if (match) return `${match[2]} ${match[1].trim()}`;
    match = text.match(/^(\d+)\s*([^\d]+)$/);
    if (match) return `${match[1]} ${match[2].trim()}`;
    return text;
  };

  const formattedDate = invoice.invoice_date
    ? new Date(invoice.invoice_date).toLocaleDateString("ar-EG")
    : "-";

  /* ──── مقياس المعاينة ──── */
  const previewScale = Math.min(1, 520 / ((pageW / 25.4) * 96));

  return (
    <>
      <style>{`
html, body { margin:0; padding:0; height:100%; overflow:hidden; }
body { background:#3b3b3b; font-family:Tahoma,Arial; }

/* ===== التخطيط الرئيسي - شبيه بـ Chrome Print ===== */
.print-modal {
  display:flex; height:100vh; direction:rtl;
}

/* ===== لوحة الإعدادات (يمين) ===== */
.settings-panel {
  width:320px; min-width:320px;
  background:#fff;
  border-left:1px solid #e2e8f0;
  display:flex; flex-direction:column;
  overflow-y:auto;
  box-shadow:2px 0 16px rgba(0,0,0,0.08);
}

.settings-header {
  padding:16px 20px 12px;
  border-bottom:1px solid #e2e8f0;
  display:flex; align-items:center; justify-content:space-between;
}
.settings-header h2 {
  margin:0; font-size:18px; font-weight:700; color:#1e293b;
}

.settings-body {
  padding:12px 20px 20px;
  flex:1; overflow-y:auto;
}

.setting-group {
  margin-bottom:16px;
}
.setting-group:last-child { margin-bottom:0; }

.setting-label {
  display:block; font-size:12px; font-weight:600;
  color:#64748b; margin-bottom:6px;
}

.setting-row {
  display:flex; align-items:center; justify-content:space-between;
  padding:6px 0;
}
.setting-row-label {
  font-size:13px; color:#334155;
}

/* ===== عناصر الفورم ===== */
.s-select, .s-input {
  width:100%; padding:7px 10px;
  border:1px solid #d1d5db; border-radius:8px;
  font-size:13px; background:#fff; color:#1e293b;
  outline:none; font-family:inherit;
}
.s-select:focus, .s-input:focus {
  border-color:#3b82f6;
  box-shadow:0 0 0 3px rgba(59,130,246,0.15);
}
.s-input-sm {
  width:64px; text-align:center;
  padding:7px 6px; border:1px solid #d1d5db;
  border-radius:8px; font-size:13px; outline:none;
}
.s-input-sm:focus {
  border-color:#3b82f6;
  box-shadow:0 0 0 3px rgba(59,130,246,0.15);
}

/* ===== Toggle Switch ===== */
.toggle-track {
  width:40px; height:22px; border-radius:11px;
  background:#d1d5db; position:relative;
  cursor:pointer; transition:background 0.2s;
  flex-shrink:0;
}
.toggle-track.active { background:#3b82f6; }
.toggle-thumb {
  width:18px; height:18px; border-radius:50%;
  background:#fff; position:absolute; top:2px; right:2px;
  transition:transform 0.2s; box-shadow:0 1px 3px rgba(0,0,0,0.2);
}
.toggle-track.active .toggle-thumb { transform:translateX(-18px); }

/* ===== ألوان الخط ===== */
.color-grid {
  display:flex; flex-wrap:wrap; gap:6px;
}
.color-dot {
  width:28px; height:28px; border-radius:50%;
  border:2px solid transparent; cursor:pointer;
  transition:all 0.15s; display:flex; align-items:center;
  justify-content:center;
}
.color-dot:hover { transform:scale(1.15); }
.color-dot.selected { border-color:#3b82f6; box-shadow:0 0 0 2px rgba(59,130,246,0.3); }

/* ===== أزرار الأكشن ===== */
.settings-footer {
  padding:12px 20px; border-top:1px solid #e2e8f0;
  display:flex; gap:8px;
}
.btn-print {
  flex:1; padding:10px; border:none; border-radius:8px;
  background:#3b82f6; color:#fff; font-size:14px;
  font-weight:600; cursor:pointer; display:flex;
  align-items:center; justify-content:center; gap:8px;
  transition:background 0.15s;
}
.btn-print:hover:not(:disabled) { background:#2563eb; }
.btn-print:disabled { opacity:0.6; cursor:not-allowed; }

.btn-cancel {
  padding:10px 16px; border:1px solid #d1d5db; border-radius:8px;
  background:#fff; color:#475569; font-size:14px;
  font-weight:500; cursor:pointer; transition:all 0.15s;
}
.btn-cancel:hover { background:#f8fafc; border-color:#94a3b8; }

/* ===== منطقة المعاينة (يسار) ===== */
.preview-panel {
  flex:1; display:flex; align-items:center;
  justify-content:center; overflow:auto;
  background:#525659; padding:24px;
}

.preview-page {
  background:white;
  box-shadow:0 8px 40px rgba(0,0,0,0.3);
  transform-origin:top center;
  overflow:hidden;
}

/* ===== محتوى الفاتورة داخل المعاينة ===== */
.invoice-wrap {
  direction:rtl; box-sizing:border-box;
  color:${printColor} !important;
  ${printBold ? "font-weight:bold;" : ""}
}
.invoice-wrap * { color:${printColor} !important; }
.invoice-header {
  display:flex; align-items:center;
  justify-content:space-between; margin-bottom:8px;
}
.invoice-info { line-height:1.4; text-align:right; min-width:170px; }
table { width:100%; border-collapse:collapse; }
th { background:#f3f3f3; font-weight:bold; border-bottom:2px solid ${printColor}; }
td { border-bottom:1px solid #ddd; }
th,td { padding:3px 4px; text-align:center; }
.totals-section {
  margin-top:4px; padding-top:4px;
  border-top:2px solid ${printColor};
  width:55%; margin-left:0; margin-right:auto;
  line-height:1.5; text-align:left;
}

/* iframe مخفي */
.print-iframe { position:fixed; top:-9999px; left:-9999px; width:0; height:0; border:none; }

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .print-modal { flex-direction:column-reverse; }
  .settings-panel { width:100%; min-width:unset; max-height:50vh; border-left:none; border-top:1px solid #e2e8f0; }
  .preview-panel { min-height:50vh; }
}

/* ===== الطباعة ===== */
@media print { body { display:none; } }
      `}</style>

      <iframe ref={iframeRef} className="print-iframe" title="print-frame" />

      <div className="print-modal">
        {/* ═══════ لوحة الإعدادات ═══════ */}
        <div className="settings-panel">
          <div className="settings-header">
            <h2>🖨️ إعدادات الطباعة</h2>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>
              فاتورة #{invoice.id}
            </span>
          </div>

          <div className="settings-body">
            {/* عدد النسخ */}
            <div className="setting-group">
              <label className="setting-label">عدد النسخ</label>
              <input
                className="s-input-sm"
                type="number"
                min={1}
                max={20}
                value={copies}
                onChange={(e) => {
                  const v = Math.max(
                    1,
                    Math.min(20, Number(e.target.value) || 1),
                  );
                  setCopies(v);
                  savePrintSettings({ copies: v });
                }}
              />
            </div>

            {/* حجم الورق */}
            <div className="setting-group">
              <label className="setting-label">حجم الورق</label>
              <select
                className="s-select"
                value={paperSize}
                onChange={(e) => {
                  const v = e.target.value as PaperSize;
                  setPaperSize(v);
                  savePrintSettings({ paperSize: v });
                }}
              >
                <option value="A5">A5 (148 × 210 مم)</option>
                <option value="A4">A4 (210 × 297 مم)</option>
                <option value="A6">A6 (105 × 148 مم)</option>
              </select>
            </div>

            {/* اتجاه الورقة */}
            <div className="setting-group">
              <label className="setting-label">اتجاه الورقة</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["portrait", "landscape"] as Orientation[]).map((o) => (
                  <button
                    key={o}
                    onClick={() => {
                      setOrientation(o);
                      savePrintSettings({ orientation: o });
                    }}
                    style={{
                      flex: 1,
                      padding: "8px 10px",
                      borderRadius: 8,
                      border:
                        orientation === o
                          ? "2px solid #3b82f6"
                          : "1px solid #d1d5db",
                      background: orientation === o ? "#eff6ff" : "#fff",
                      color: orientation === o ? "#1d4ed8" : "#475569",
                      fontWeight: orientation === o ? 600 : 400,
                      fontSize: 13,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      fontFamily: "inherit",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: o === "portrait" ? 14 : 20,
                        height: o === "portrait" ? 20 : 14,
                        border: "2px solid currentColor",
                        borderRadius: 2,
                      }}
                    />
                    {o === "portrait" ? "طولي" : "عرضي"}
                  </button>
                ))}
              </div>
            </div>

            {/* الهوامش */}
            <div className="setting-group">
              <label className="setting-label">الهوامش</label>
              <select
                className="s-select"
                value={margins}
                onChange={(e) => {
                  const v = e.target.value as MarginSize;
                  setMargins(v);
                  savePrintSettings({ margins: v });
                }}
              >
                <option value="normal">عادية (10مم)</option>
                <option value="narrow">ضيقة (5مم)</option>
                <option value="none">بدون هوامش</option>
              </select>
            </div>

            <hr
              style={{
                border: "none",
                borderTop: "1px solid #e2e8f0",
                margin: "12px 0",
              }}
            />

            {/* حجم الخط */}
            <div className="setting-group">
              <label className="setting-label">حجم الخط: {fontSize}px</label>
              <input
                type="range"
                min={7}
                max={16}
                value={fontSize}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setFontSize(v);
                  savePrintSettings({ fontSize: v });
                }}
                style={{ width: "100%", accentColor: "#3b82f6" }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 10,
                  color: "#94a3b8",
                }}
              >
                <span>7</span>
                <span>16</span>
              </div>
            </div>

            {/* خط عريض */}
            <div className="setting-group">
              <div className="setting-row">
                <span className="setting-row-label">خط عريض</span>
                <div
                  className={`toggle-track ${printBold ? "active" : ""}`}
                  onClick={() => {
                    setPrintBold(!printBold);
                    // Also save to appSettings for consistency
                    try {
                      const raw = localStorage.getItem("appSettings");
                      const s = raw ? JSON.parse(raw) : {};
                      s.printBold = !printBold;
                      localStorage.setItem("appSettings", JSON.stringify(s));
                    } catch {}
                  }}
                >
                  <div className="toggle-thumb" />
                </div>
              </div>
            </div>

            {/* لون الخط */}
            <div className="setting-group">
              <label className="setting-label">لون الخط</label>
              <div className="color-grid">
                {COLOR_PRESETS.map((c) => (
                  <div
                    key={c.value}
                    className={`color-dot ${printColor === c.value ? "selected" : ""}`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                    onClick={() => {
                      setPrintColor(c.value);
                      try {
                        const raw = localStorage.getItem("appSettings");
                        const s = raw ? JSON.parse(raw) : {};
                        s.printColor = c.value;
                        localStorage.setItem("appSettings", JSON.stringify(s));
                      } catch {}
                    }}
                  >
                    {printColor === c.value && (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#fff"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                ))}
                <label
                  className="color-dot"
                  style={{
                    backgroundColor:
                      "conic-gradient(red,yellow,lime,aqua,blue,magenta,red)",
                    background:
                      "conic-gradient(red,yellow,lime,aqua,blue,magenta,red)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                  title="لون مخصص"
                >
                  <input
                    type="color"
                    value={printColor}
                    onChange={(e) => {
                      setPrintColor(e.target.value);
                      try {
                        const raw = localStorage.getItem("appSettings");
                        const s = raw ? JSON.parse(raw) : {};
                        s.printColor = e.target.value;
                        localStorage.setItem("appSettings", JSON.stringify(s));
                      } catch {}
                    }}
                    style={{
                      position: "absolute",
                      opacity: 0,
                      width: "100%",
                      height: "100%",
                      cursor: "pointer",
                    }}
                  />
                </label>
              </div>
            </div>

            <hr
              style={{
                border: "none",
                borderTop: "1px solid #e2e8f0",
                margin: "12px 0",
              }}
            />

            {/* إظهار/إخفاء اللوجو */}
            <div className="setting-group">
              <div className="setting-row">
                <span className="setting-row-label">إظهار اللوجو</span>
                <div
                  className={`toggle-track ${showLogo ? "active" : ""}`}
                  onClick={() => {
                    setShowLogo(!showLogo);
                    savePrintSettings({ showLogo: !showLogo });
                  }}
                >
                  <div className="toggle-thumb" />
                </div>
              </div>
            </div>

            {/* إظهار/إخفاء التليفون */}
            {invoice.customer_phone && (
              <div className="setting-group">
                <div className="setting-row">
                  <span className="setting-row-label">إظهار رقم التليفون</span>
                  <div
                    className={`toggle-track ${showPhone ? "active" : ""}`}
                    onClick={() => {
                      setShowPhone(!showPhone);
                      savePrintSettings({ showPhone: !showPhone });
                    }}
                  >
                    <div className="toggle-thumb" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* أزرار */}
          <div className="settings-footer">
            <button
              className="btn-print"
              onClick={handlePrint}
              disabled={isPrinting}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              {isPrinting
                ? "جاري الطباعة..."
                : `طباعة${copies > 1 ? ` (${copies} نسخ)` : ""}`}
            </button>
            <button
              className="btn-cancel"
              onClick={() => window.history.back()}
            >
              إلغاء
            </button>
          </div>
        </div>

        {/* ═══════ منطقة المعاينة ═══════ */}
        <div className="preview-panel">
          <div
            className="preview-page"
            style={{
              width: `${(pageW / 25.4) * 96}px`,
              minHeight: `${(pageH / 25.4) * 96}px`,
              transform: `scale(${previewScale})`,
            }}
          >
            <div
              className="invoice-wrap"
              ref={invoiceRef}
              style={{
                padding: `${marginMM}mm`,
                fontSize: `${fontSize}px`,
              }}
            >
              {/* HEADER */}
              <div className="invoice-header">
                <div
                  className="invoice-info"
                  style={{ fontSize: `${fontSize}px` }}
                >
                  <div>
                    <b>رقم الفاتورة:</b> {invoice.id}
                  </div>
                  <div>
                    <b>التاريخ:</b> {formattedDate}
                  </div>
                  <div>
                    <b>العميل:</b> {invoice.customer_name || "نقدي"}
                  </div>
                  {invoice.customer_phone && showPhone && (
                    <div>
                      <b>تليفون:</b> {invoice.customer_phone}
                    </div>
                  )}
                </div>
                {showLogo && (
                  <img
                    src="/logo-dark.png"
                    alt="Logo"
                    style={{ width: 65 }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
              </div>

              <hr
                style={{
                  border: "none",
                  borderTop: "2px solid #000",
                  marginBottom: 10,
                }}
              />

              {/* جدول الأصناف */}
              <table style={{ fontSize: `${fontSize}px` }}>
                <thead>
                  <tr>
                    <th>م</th>
                    <th>الصنف</th>
                    <th>العبوة</th>
                    <th>الكمية</th>
                    <th>السعر</th>
                    <th>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => {
                    const displayQty = it.is_return
                      ? -Math.abs(it.quantity)
                      : it.quantity;
                    const displayTotal = it.is_return
                      ? -Math.abs(Math.round(calcItemTotal(it)))
                      : Math.round(calcItemTotal(it));
                    return (
                      <tr
                        key={i}
                        style={
                          it.is_return
                            ? { color: "red !important", background: "#fff5f5" }
                            : undefined
                        }
                      >
                        <td>{i + 1}</td>
                        <td>
                          {it.product_name}
                          {it.manufacturer ? ` - ${it.manufacturer}` : ""}
                          {it.is_return && (
                            <span
                              style={{
                                color: "red",
                                fontSize: fontSize - 1,
                                marginRight: 4,
                              }}
                            >
                              (مرتجع)
                            </span>
                          )}
                        </td>
                        <td>{formatPackage(it)}</td>
                        <td style={it.is_return ? { color: "red" } : undefined}>
                          {displayQty}
                        </td>
                        <td>{Math.round(calcUnitPrice(it))}</td>
                        <td style={it.is_return ? { color: "red" } : undefined}>
                          {displayTotal}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: "bold", background: "#fafafa" }}>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td>{totalQty}</td>
                    <td></td>
                    <td>{Math.round(itemsSubtotal)}</td>
                  </tr>
                </tfoot>
              </table>

              {/* التوتالز */}
              <div
                className="totals-section"
                style={{ fontSize: `${fontSize + 1}px` }}
              >
                {previousBalance !== 0 && (
                  <div>حساب سابق: {previousBalance.toFixed(2)}</div>
                )}
                {extraDiscount > 0 && (
                  <div>خصم : {extraDiscount.toFixed(2)}</div>
                )}
                <div>
                  <b>الصافي: {netTotal.toFixed(2)}</b>
                </div>
                {paidAmount !== 0 && (
                  <div>المدفوع: {paidAmount.toFixed(2)}</div>
                )}
                {remaining !== 0 && (
                  <div
                    className="totals-remaining"
                    style={{ fontSize: `${fontSize + 3}px` }}
                  >
                    <b>المتبقي: {remaining.toFixed(2)}</b>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
