"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import api from "@/services/api";
import QRCode from "qrcode";

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
  additional_amount?: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: string;
  apply_items_discount: boolean;
  created_by_name?: string;
  updated_by_name?: string;
  items: InvoiceItem[];
}

interface CustomPhoneEntry {
  id: string;
  value: string;
  visible: boolean;
}

type PaperSize = "A5" | "A4" | "A6";
type Orientation = "portrait" | "landscape";
type MarginSize = "normal" | "narrow" | "none";

const FIXED_INVOICE_PAPER_SIZE: PaperSize = "A5";
const INVOICE_QR_VALUE = "https://www.hg-alshour.online";

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

const FONT_OPTIONS = [
  { label: "Tahoma", value: "Tahoma, Arial, sans-serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Cairo", value: "Cairo, sans-serif" },
  { label: "Amiri", value: "Amiri, serif" },
  { label: "Noto Kufi Arabic", value: "Noto Kufi Arabic, sans-serif" },
  { label: "Tajawal", value: "Tajawal, sans-serif" },
  { label: "IBM Plex Sans Arabic", value: "IBM Plex Sans Arabic, sans-serif" },
  { label: "Almarai", value: "Almarai, sans-serif" },
  { label: "Noto Sans Arabic", value: "Noto Sans Arabic, sans-serif" },
];

const createPhoneEntry = (value = "", visible = true): CustomPhoneEntry => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  value,
  visible,
});

const normalizeCustomPhones = (
  raw: unknown,
  legacyValue = "",
  legacyVisible = true,
): CustomPhoneEntry[] => {
  if (Array.isArray(raw)) {
    const normalized = raw
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;

        const phone = entry as Partial<CustomPhoneEntry>;
        return createPhoneEntry(
          typeof phone.value === "string" ? phone.value : "",
          phone.visible !== undefined ? Boolean(phone.visible) : true,
        );
      })
      .filter((entry): entry is CustomPhoneEntry => entry !== null);

    if (normalized.length > 0) {
      return normalized;
    }
  }

  if (typeof legacyValue === "string" && legacyValue.trim()) {
    return [createPhoneEntry(legacyValue, legacyVisible)];
  }

  return [createPhoneEntry()];
};

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
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [margins, setMargins] = useState<MarginSize>("normal");
  const [printBold, setPrintBold] = useState(false);
  const [fontSize, setFontSize] = useState(10);
  const [borderWidth, setBorderWidth] = useState(1);
  const [borderColor, setBorderColor] = useState("#cccccc");
  const [verticalBorderWidth, setVerticalBorderWidth] = useState(0);
  const [verticalBorderColor, setVerticalBorderColor] = useState("#cccccc");
  const [showLogo, setShowLogo] = useState(true);
  const [showPhone, setShowPhone] = useState(true);
  const [customPhones, setCustomPhones] = useState<CustomPhoneEntry[]>([
    createPhoneEntry(),
  ]);
  const [fontFamily, setFontFamily] = useState("Tahoma, Arial, sans-serif");
  const [isPrinting, setIsPrinting] = useState(false);
  const [invoiceQrDataUrl, setInvoiceQrDataUrl] = useState("");

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const paperSize = FIXED_INVOICE_PAPER_SIZE;

  /* ──── تحميل الإعدادات من localStorage ──── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("appSettings");
      if (raw) {
        const s = JSON.parse(raw);
        if (s.printBold !== undefined) setPrintBold(s.printBold);
      }
    } catch {}
    try {
      const raw = localStorage.getItem("printSettings");
      if (raw) {
        const s = JSON.parse(raw);
        if (s.copies) setCopies(s.copies);
        if (s.orientation) setOrientation(s.orientation);
        if (s.margins) setMargins(s.margins);
        if (s.fontSize) setFontSize(s.fontSize);
        if (s.borderWidth !== undefined) setBorderWidth(s.borderWidth);
        if (s.borderColor) setBorderColor(s.borderColor);
        if (s.verticalBorderWidth !== undefined)
          setVerticalBorderWidth(s.verticalBorderWidth);
        if (s.verticalBorderColor)
          setVerticalBorderColor(s.verticalBorderColor);
        if (s.showLogo !== undefined) setShowLogo(s.showLogo);
        if (s.showPhone !== undefined) setShowPhone(s.showPhone);
        setCustomPhones(
          normalizeCustomPhones(
            s.customPhones,
            typeof s.customPhone === "string" ? s.customPhone : "",
            s.showCustomPhone !== undefined ? Boolean(s.showCustomPhone) : true,
          ),
        );
        if (s.fontFamily) setFontFamily(s.fontFamily);
      }
    } catch {}
  }, []);

  /* ──── حفظ إعدادات الطباعة ──── */
  const savePrintSettings = useCallback(
    (patch: Record<string, unknown>) => {
      try {
        const raw = localStorage.getItem("printSettings");
        const prev = raw ? JSON.parse(raw) : {};
        const legacyPrimaryPhone = customPhones[0]?.value ?? "";
        const legacyPrimaryVisible = customPhones[0]?.visible ?? true;
        const next = {
          ...prev,
          copies,
          orientation,
          margins,
          fontSize,
          borderWidth,
          borderColor,
          verticalBorderWidth,
          verticalBorderColor,
          showLogo,
          showPhone,
          customPhones,
          customPhone: legacyPrimaryPhone,
          showCustomPhone: legacyPrimaryVisible,
          fontFamily,
          ...patch,
          paperSize: FIXED_INVOICE_PAPER_SIZE,
        };
        localStorage.setItem("printSettings", JSON.stringify(next));
      } catch {}
    },
    [
      copies,
      paperSize,
      orientation,
      margins,
      fontSize,
      borderWidth,
      borderColor,
      verticalBorderWidth,
      verticalBorderColor,
      showLogo,
      showPhone,
      customPhones,
      fontFamily,
    ],
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

  useEffect(() => {
    let cancelled = false;

    const generateInvoiceQr = async () => {
      try {
        const dataUrl = await QRCode.toDataURL(INVOICE_QR_VALUE, {
          errorCorrectionLevel: "M",
          margin: 0,
          width: 160,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        });

        if (!cancelled) {
          setInvoiceQrDataUrl(dataUrl);
        }
      } catch {
        if (!cancelled) {
          setInvoiceQrDataUrl("");
        }
      }
    };

    void generateInvoiceQr();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ──── أبعاد الورقة الفعلية ──── */
  const paper = PAPER_DIMS[FIXED_INVOICE_PAPER_SIZE];
  const pageW = orientation === "portrait" ? paper.w : paper.h;
  const pageH = orientation === "portrait" ? paper.h : paper.w;
  const marginMM = MARGIN_VALUES[margins];

  /* ──── بناء HTML الطباعة ──── */
  const buildPrintHTML = useCallback(() => {
    if (!invoiceRef.current) return "";
    const html = invoiceRef.current.innerHTML;

    const css = `
      <style>
        body { margin:0; padding:0; background:white; font-family:${fontFamily}; direction:rtl; }
        .invoice-wrap {
          width:100%; margin:0; padding:${marginMM}mm; box-sizing:border-box;
          direction:rtl; font-size:${fontSize}px; font-family:${fontFamily};
          ${printBold ? "font-weight:bold;" : ""}
        }
        .invoice-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
        .invoice-header.with-qr {
          display:grid;
          direction:ltr;
          grid-template-columns:minmax(170px, 1fr) auto minmax(170px, 1fr);
          align-items:start;
          column-gap:10px;
        }
        .invoice-info { font-size:${fontSize}px; line-height:1.4; text-align:right; min-width:170px; }
        .invoice-header.with-qr .invoice-info {
          direction:rtl;
          grid-column:3;
          align-self:start;
          justify-self:end;
        }
        .invoice-middle {
          grid-column:2;
          display:flex;
          align-items:flex-start;
          justify-content:center;
          align-self:start;
          justify-self:center;
        }
        .invoice-qr { width:72px; height:72px; object-fit:contain; display:block; }
        .logo-section { display:flex; flex-direction:row; align-items:flex-start; gap:8px; }
        .invoice-header.with-qr .logo-section,
        .invoice-header.with-qr .header-meta-block {
          direction:rtl;
          grid-column:1;
          align-self:start;
          justify-self:start;
        }
        .logo-phone-list { display:flex; flex-direction:column; align-items:center; gap:2px; }
        .logo-phone { font-size:${fontSize}px; font-weight:bold; }
        table { width:100%; border-collapse:collapse; font-size:${fontSize}px; }
        thead th { background:#f3f3f3; font-weight:bold; border-bottom:2px solid #000; }
        thead th:first-child, thead th:nth-child(3), thead th:nth-child(4), thead th:nth-child(5) { ${verticalBorderWidth > 0 ? `border-left:${verticalBorderWidth}px solid ${verticalBorderColor};` : ""} }
        tbody td { border-bottom:${borderWidth}px solid ${borderColor}; }
        tbody td:first-child, tbody td:nth-child(3), tbody td:nth-child(4), tbody td:nth-child(5) { ${verticalBorderWidth > 0 ? `border-left:${verticalBorderWidth}px solid ${verticalBorderColor};` : ""} }
        th,td { padding:3px 4px; text-align:center; }
        tfoot td { border-left:none !important; border-right:none !important; }
        tfoot tr:first-child { border-top:3px solid #000; }
        tfoot tr:first-child td { border-bottom:none; }
        tfoot tr:first-child td:nth-last-child(1),
        tfoot tr:first-child td:nth-last-child(2) { border-bottom:2px solid #000; }
        tfoot .summary-row td { border-bottom:none; padding:1px 4px; font-size:${fontSize + 1}px; }
        tfoot .summary-remaining td { font-size:${fontSize + 3}px; }
        hr { border:none; border-top:2px solid #000; margin-bottom:10px; }
        @page { size:${pageW}mm ${pageH}mm; margin:${marginMM}mm; }
        table { page-break-inside:auto; break-inside:auto; }
        tr { page-break-inside:avoid; break-inside:avoid; }
        thead { display:table-header-group; }
        tfoot { display:table-row-group; }
      </style>
    `;

    let pages = "";
    for (let c = 0; c < copies; c++) {
      pages += `<div class="invoice-wrap" ${c > 0 ? 'style="page-break-before:always;"' : ""}>${html}</div>`;
    }
    const fontLink = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&family=Amiri:wght@400;700&family=Noto+Kufi+Arabic:wght@400;700&family=Tajawal:wght@400;700&family=IBM+Plex+Sans+Arabic:wght@400;700&family=Almarai:wght@400;700&family=Noto+Sans+Arabic:wght@400;700&display=swap">`;
    return `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8">${fontLink}${css}</head><body>${pages}</body></html>`;
  }, [
    copies,
    paperSize,
    orientation,
    margins,
    printBold,
    fontSize,
    borderWidth,
    borderColor,
    verticalBorderWidth,
    verticalBorderColor,
    fontFamily,
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

  const applyDiscount = invoice.apply_items_discount ?? true;

  const calcUnitPrice = (it: InvoiceItem) => {
    if (!applyDiscount) return Number(it.price);
    return Number(it.price) - Number(it.discount || 0);
  };

  const calcItemTotal = (it: InvoiceItem) => {
    const qty = Number(it.quantity || 0);
    if (!applyDiscount) return Number(it.price) * qty;
    return (Number(it.price) - Number(it.discount || 0)) * qty;
  };

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
  const additionalAmount =
    invoice.invoice_type === "wholesale"
      ? Number(invoice.additional_amount) || 0
      : 0;
  const paidAmount = Number(invoice.paid_amount) || 0;
  const netTotal =
    itemsSubtotal + previousBalance + additionalAmount - extraDiscount;
  const remaining = netTotal - paidAmount;

  const totalQty = items.reduce(
    (sum, it) => (it.is_return ? sum : sum + Number(it.quantity || 0)),
    0,
  );

  /** يعرض الرقم بكسور لو فيه، وبدون لو عدد صحيح */
  const fmt = (n: number) => {
    const val = Number(n);
    return val % 1 === 0
      ? val.toString()
      : parseFloat(val.toFixed(2)).toString();
  };

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

  const getDayName = (dateStr?: string) => {
    if (!dateStr) return "";
    const days = [
      "الأحد",
      "الاثنين",
      "الثلاثاء",
      "الأربعاء",
      "الخميس",
      "الجمعة",
      "السبت",
    ];
    const date = new Date(dateStr);
    return days[date.getDay()] || "";
  };

  const formattedDate = invoice.invoice_date
    ? `${getDayName(invoice.invoice_date)} ${new Date(invoice.invoice_date).toLocaleDateString("ar-EG")}`
    : "-";
  const invoiceUserName = (
    invoice.updated_by_name ||
    invoice.created_by_name ||
    ""
  ).trim();
  const visibleCustomPhones = customPhones.filter(
    (phone) => phone.visible && phone.value.trim(),
  );
  const hasVisibleCustomPhones = visibleCustomPhones.length > 0;
  const showInvoiceQr =
    invoice.movement_type === "sale" &&
    (invoice.invoice_type === "retail" ||
      invoice.invoice_type === "wholesale") &&
    Boolean(invoiceQrDataUrl);

  const updateCustomPhone = (id: string, value: string) => {
    const nextPhones = customPhones.map((phone) =>
      phone.id === id ? { ...phone, value } : phone,
    );
    setCustomPhones(nextPhones);
    savePrintSettings({
      customPhones: nextPhones,
      customPhone: nextPhones[0]?.value ?? "",
      showCustomPhone: nextPhones[0]?.visible ?? true,
    });
  };

  const toggleCustomPhoneVisibility = (id: string) => {
    const nextPhones = customPhones.map((phone) =>
      phone.id === id ? { ...phone, visible: !phone.visible } : phone,
    );
    setCustomPhones(nextPhones);
    savePrintSettings({
      customPhones: nextPhones,
      customPhone: nextPhones[0]?.value ?? "",
      showCustomPhone: nextPhones[0]?.visible ?? true,
    });
  };

  const addCustomPhone = () => {
    const nextPhones = [...customPhones, createPhoneEntry()];
    setCustomPhones(nextPhones);
    savePrintSettings({ customPhones: nextPhones });
  };

  const removeCustomPhone = (id: string) => {
    const nextPhones = customPhones.filter((phone) => phone.id !== id);
    const safePhones =
      nextPhones.length > 0 ? nextPhones : [createPhoneEntry()];
    setCustomPhones(safePhones);
    savePrintSettings({
      customPhones: safePhones,
      customPhone: safePhones[0]?.value ?? "",
      showCustomPhone: safePhones[0]?.visible ?? true,
    });
  };

  /* ──── مقياس المعاينة ──── */
  const previewScale = Math.min(1, 520 / ((pageW / 25.4) * 96));

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&family=Amiri:wght@400;700&family=Noto+Kufi+Arabic:wght@400;700&family=Tajawal:wght@400;700&family=IBM+Plex+Sans+Arabic:wght@400;700&family=Almarai:wght@400;700&family=Noto+Sans+Arabic:wght@400;700&display=swap"
      />
      <style>{`
html, body { margin:0; padding:0; height:100%; overflow:hidden; color-scheme:light; }
body { background:#3b3b3b; font-family:${fontFamily}; color:#000; }

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
  color-scheme:light;
  color:#1e293b;
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
  color-scheme:light;
}

.preview-page {
  background:white !important; color:#000 !important;
  box-shadow:0 8px 40px rgba(0,0,0,0.3);
  transform-origin:top center;
  overflow:hidden;
  color-scheme:light;
}

/* ===== محتوى الفاتورة داخل المعاينة ===== */
.invoice-wrap {
  direction:rtl; box-sizing:border-box;
  background:#fff !important; color:#000 !important;
  color-scheme:light;
  ${printBold ? "font-weight:bold;" : ""}
}
.invoice-wrap * { color:#000 !important; }
.invoice-wrap b, .invoice-wrap strong { color:#000 !important; }
.invoice-header {
  display:flex; align-items:center;
  justify-content:space-between; margin-bottom:8px;
}
.invoice-header.with-qr {
  display:grid;
  direction:ltr;
  grid-template-columns:minmax(170px, 1fr) auto minmax(170px, 1fr);
  align-items:start;
  column-gap:10px;
}
.invoice-info { line-height:1.4; text-align:right; min-width:170px; color:#000; }
.invoice-header.with-qr .invoice-info {
  direction:rtl;
  grid-column:3;
  align-self:start;
  justify-self:end;
}
.invoice-middle {
  grid-column:2;
  display:flex; align-items:flex-start; justify-content:center;
  align-self:start;
  justify-self:center;
}
.invoice-qr {
  width:72px; height:72px; object-fit:contain; display:block;
}
.logo-section { display:flex; flex-direction:row; align-items:flex-start; gap:8px; }
.invoice-header.with-qr .logo-section,
.invoice-header.with-qr .header-meta-block {
  direction:rtl;
  grid-column:1;
  align-self:start;
  justify-self:start;
}
.logo-phone-list { display:flex; flex-direction:column; align-items:center; gap:2px; }
.logo-phone { font-weight:bold; color:#000; }
.phone-list { display:flex; flex-direction:column; gap:10px; }
.phone-item { border:1px solid #e2e8f0; border-radius:10px; padding:10px; background:#f8fafc; }
.phone-item-header { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
.phone-item-actions { display:flex; align-items:center; gap:8px; }
.btn-add-phone, .btn-remove-phone {
  border:1px solid #cbd5e1; border-radius:8px; background:#fff; color:#334155;
  font-size:12px; font-family:inherit; cursor:pointer;
}
.btn-add-phone {
  width:100%; padding:8px 10px; font-weight:600;
}
.btn-remove-phone {
  padding:6px 10px;
}
.btn-add-phone:hover, .btn-remove-phone:hover { background:#f1f5f9; }
table { width:100%; border-collapse:collapse; background:#fff !important; color:#000; }
thead th { background:#f3f3f3 !important; font-weight:bold; border-bottom:2px solid #000; color:#000 !important; }
thead th:first-child, thead th:nth-child(3), thead th:nth-child(4), thead th:nth-child(5) { ${verticalBorderWidth > 0 ? `border-left:${verticalBorderWidth}px solid ${verticalBorderColor};` : ""} }
tbody td { border-bottom:${borderWidth}px solid ${borderColor}; color:#000 !important; background:#fff !important; }
tbody td:first-child, tbody td:nth-child(3), tbody td:nth-child(4), tbody td:nth-child(5) { ${verticalBorderWidth > 0 ? `border-left:${verticalBorderWidth}px solid ${verticalBorderColor};` : ""} }
th,td { padding:3px 4px; text-align:center; }
tfoot td { border-left:none !important; border-right:none !important; }
tfoot tr:first-child { border-top:3px solid #000; background:#fafafa !important; }
tfoot tr:first-child td { border-bottom:none; }
tfoot tr:first-child td:nth-last-child(1),
tfoot tr:first-child td:nth-last-child(2) { border-bottom:2px solid #000; }
tfoot .summary-row td { border-bottom:none; padding:1px 4px; }
.totals-section {
  margin-top:6px; padding-top:6px;
  border-top:none;
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
        {!isPreview && (
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
                <div
                  className="s-select"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "#f8fafc",
                    cursor: "default",
                  }}
                >
                  <span>A5</span>
                  <span style={{ fontSize: 12, color: "#64748b" }}>
                    ثابت لكل الفواتير
                  </span>
                </div>
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

              {/* نوع الخط */}
              <div className="setting-group">
                <label className="setting-label">نوع الخط</label>
                <select
                  className="s-select"
                  value={fontFamily}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFontFamily(v);
                    savePrintSettings({ fontFamily: v });
                  }}
                >
                  {FONT_OPTIONS.map((f) => (
                    <option
                      key={f.value}
                      value={f.value}
                      style={{ fontFamily: f.value }}
                    >
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

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

              {/* سمك الخط الفاصل */}
              <div className="setting-group">
                <label className="setting-label">سمك الخط الفاصل</label>
                <select
                  className="s-select"
                  value={borderWidth}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setBorderWidth(v);
                    savePrintSettings({ borderWidth: v });
                  }}
                >
                  <option value={0}>بدون خط</option>
                  <option value={0.5}>رفيع جداً (0.5px)</option>
                  <option value={1}>رفيع (1px)</option>
                  <option value={1.5}>متوسط (1.5px)</option>
                  <option value={2}>سميك (2px)</option>
                  <option value={3}>سميك جداً (3px)</option>
                </select>
              </div>

              {/* لون الخط الفاصل */}
              <div className="setting-group">
                <label className="setting-label">لون الخط الفاصل</label>
                <div className="color-grid">
                  {[
                    { label: "رمادي فاتح", value: "#e5e5e5" },
                    { label: "رمادي", value: "#cccccc" },
                    { label: "رمادي غامق", value: "#999999" },
                    { label: "أسود", value: "#000000" },
                    { label: "أزرق فاتح", value: "#bfdbfe" },
                    { label: "أخضر فاتح", value: "#bbf7d0" },
                  ].map((c) => (
                    <div
                      key={c.value}
                      className={`color-dot ${borderColor === c.value ? "selected" : ""}`}
                      style={{
                        backgroundColor: c.value,
                        border: "1px solid #ccc",
                      }}
                      title={c.label}
                      onClick={() => {
                        setBorderColor(c.value);
                        savePrintSettings({ borderColor: c.value });
                      }}
                    >
                      {borderColor === c.value && (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={c.value === "#000000" ? "#fff" : "#000"}
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* سمك الخط الطولي */}
              <div className="setting-group">
                <label className="setting-label">سمك الخط الطولي</label>
                <select
                  className="s-select"
                  value={verticalBorderWidth}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setVerticalBorderWidth(v);
                    savePrintSettings({ verticalBorderWidth: v });
                  }}
                >
                  <option value={0}>بدون خط</option>
                  <option value={0.5}>رفيع جداً (0.5px)</option>
                  <option value={1}>رفيع (1px)</option>
                  <option value={1.5}>متوسط (1.5px)</option>
                  <option value={2}>سميك (2px)</option>
                  <option value={3}>سميك جداً (3px)</option>
                </select>
              </div>

              {/* لون الخط الطولي */}
              <div className="setting-group">
                <label className="setting-label">لون الخط الطولي</label>
                <div className="color-grid">
                  {[
                    { label: "رمادي فاتح", value: "#e5e5e5" },
                    { label: "رمادي", value: "#cccccc" },
                    { label: "رمادي غامق", value: "#999999" },
                    { label: "أسود", value: "#000000" },
                    { label: "أزرق فاتح", value: "#bfdbfe" },
                    { label: "أخضر فاتح", value: "#bbf7d0" },
                  ].map((c) => (
                    <div
                      key={c.value}
                      className={`color-dot ${verticalBorderColor === c.value ? "selected" : ""}`}
                      style={{
                        backgroundColor: c.value,
                        border: "1px solid #ccc",
                      }}
                      title={c.label}
                      onClick={() => {
                        setVerticalBorderColor(c.value);
                        savePrintSettings({ verticalBorderColor: c.value });
                      }}
                    >
                      {verticalBorderColor === c.value && (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={c.value === "#000000" ? "#fff" : "#000"}
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  ))}
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

              {/* رقم تليفون مخصص بجانب اللوجو */}
              <div className="setting-group">
                <label className="setting-label">
                  أرقام التليفون بجانب اللوجو
                </label>
                <div className="phone-list">
                  {customPhones.map((phone, index) => (
                    <div key={phone.id} className="phone-item">
                      <div className="phone-item-header">
                        <span className="setting-row-label">
                          رقم {index + 1}
                        </span>
                        <div className="phone-item-actions">
                          <div
                            className={`toggle-track ${phone.visible ? "active" : ""}`}
                            onClick={() =>
                              toggleCustomPhoneVisibility(phone.id)
                            }
                            title={
                              phone.visible ? "إخفاء الرقم" : "إظهار الرقم"
                            }
                          >
                            <div className="toggle-thumb" />
                          </div>
                          <button
                            type="button"
                            className="btn-remove-phone"
                            onClick={() => removeCustomPhone(phone.id)}
                            disabled={customPhones.length === 1}
                            style={{
                              opacity: customPhones.length === 1 ? 0.5 : 1,
                              cursor:
                                customPhones.length === 1
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                          >
                            حذف
                          </button>
                        </div>
                      </div>
                      <input
                        className="s-input"
                        type="tel"
                        placeholder="اكتب رقم التليفون..."
                        value={phone.value}
                        autoComplete="tel"
                        onChange={(e) =>
                          updateCustomPhone(phone.id, e.target.value)
                        }
                        style={{ direction: "ltr", textAlign: "center" }}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn-add-phone"
                    onClick={addCustomPhone}
                  >
                    إضافة رقم جديد
                  </button>
                </div>
              </div>

              {/* إظهار/إخفاء التليفون */}
              {invoice.customer_phone && (
                <div className="setting-group">
                  <div className="setting-row">
                    <span className="setting-row-label">
                      إظهار رقم التليفون
                    </span>
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
              <button className="btn-cancel" onClick={() => window.close()}>
                إلغاء
              </button>
            </div>
          </div>
        )}

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
                fontFamily: fontFamily,
              }}
            >
              {/* HEADER */}
              <div
                className={`invoice-header${showInvoiceQr ? " with-qr" : ""}`}
              >
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
                {showInvoiceQr && (
                  <div className="invoice-middle" aria-hidden="true">
                    <img
                      src={invoiceQrDataUrl}
                      alt="QR"
                      className="invoice-qr"
                    />
                  </div>
                )}
                {showLogo && (
                  <div className="logo-section">
                    <img
                      src="/logo-dark.png"
                      alt="Logo"
                      style={{ width: 65 }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    {(invoiceUserName || hasVisibleCustomPhones) && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          lineHeight: 1.25,
                          gap: 1,
                        }}
                      >
                        {invoiceUserName && (
                          <div
                            style={{
                              fontSize: `${Math.max(fontSize - 1, 7)}px`,
                              fontWeight: "bold",
                            }}
                          >
                            {invoiceUserName}
                          </div>
                        )}
                        {hasVisibleCustomPhones && (
                          <div className="logo-phone-list">
                            {visibleCustomPhones.map((phone) => (
                              <div
                                key={phone.id}
                                className="logo-phone"
                                style={{ fontSize: `${fontSize}px` }}
                              >
                                {phone.value}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {!showLogo && (invoiceUserName || hasVisibleCustomPhones) && (
                  <div
                    className="header-meta-block"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      lineHeight: 1.25,
                      gap: 1,
                    }}
                  >
                    {invoiceUserName && (
                      <div
                        style={{
                          fontSize: `${Math.max(fontSize - 1, 7)}px`,
                          fontWeight: "bold",
                        }}
                      >
                        {invoiceUserName}
                      </div>
                    )}
                    {hasVisibleCustomPhones && (
                      <div className="logo-phone-list">
                        {visibleCustomPhones.map((phone) => (
                          <div
                            key={phone.id}
                            className="logo-phone"
                            style={{
                              fontSize: `${fontSize}px`,
                              fontWeight: "bold",
                            }}
                          >
                            {phone.value}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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
                      ? -Math.abs(calcItemTotal(it))
                      : calcItemTotal(it);
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
                        <td>{fmt(calcUnitPrice(it))}</td>
                        <td style={it.is_return ? { color: "red" } : undefined}>
                          {fmt(displayTotal)}
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
                    <td>{fmt(itemsSubtotal)}</td>
                  </tr>
                  {previousBalance !== 0 && (
                    <tr className="summary-row">
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td style={{ textAlign: "left" }}>حساب سابق</td>
                      <td>{fmt(previousBalance)}</td>
                    </tr>
                  )}
                  {additionalAmount !== 0 && (
                    <tr className="summary-row">
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td style={{ textAlign: "left" }}>إضافة</td>
                      <td>{fmt(additionalAmount)}</td>
                    </tr>
                  )}
                  {extraDiscount > 0 && (
                    <tr className="summary-row">
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td style={{ textAlign: "left" }}>خصم</td>
                      <td>{fmt(extraDiscount)}</td>
                    </tr>
                  )}
                  {(previousBalance !== 0 ||
                    additionalAmount !== 0 ||
                    extraDiscount > 0) && (
                    <tr className="summary-row">
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td style={{ textAlign: "left" }}>
                        <b>الصافي</b>
                      </td>
                      <td>
                        <b>{fmt(netTotal)}</b>
                      </td>
                    </tr>
                  )}
                  {paidAmount !== 0 && (
                    <tr className="summary-row">
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td style={{ textAlign: "left" }}>المدفوع</td>
                      <td>{fmt(paidAmount)}</td>
                    </tr>
                  )}
                  {remaining !== 0 && (
                    <tr className="summary-row summary-remaining">
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td style={{ textAlign: "left" }}>
                        <b>المتبقي</b>
                      </td>
                      <td>
                        <b>{fmt(remaining)}</b>
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
