"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Calculator, Printer, Trash2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUserPreferences } from "@/hooks/use-user-preferences";

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

type OpenSource = "icon" | "keyboard" | null;

const DEFAULT_DENOMINATIONS = [200, 100, 50, 20, 10, 5, 1];

/* ═══════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════ */

export function CashCounterModal() {
  const { prefs, loaded: prefsLoaded, setPrefs } = useUserPreferences();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<OpenSource>(null);

  // Denominations (editable)
  const [denominations, setDenominations] = useState<number[]>(
    DEFAULT_DENOMINATIONS,
  );
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [editingDenominations, setEditingDenominations] = useState(false);
  const [tempDenominations, setTempDenominations] = useState("");

  /* ───── Load saved data from user preferences (synced to server) ───── */

  const loadedRef = useRef(false);

  useEffect(() => {
    if (!prefsLoaded || loadedRef.current) return;
    const saved = prefs.cashCounter as
      | { denominations?: number[]; counts?: Record<number, number> }
      | undefined;
    if (saved) {
      if (saved.denominations?.length) setDenominations(saved.denominations);
      if (saved.counts) setCounts(saved.counts);
    }
    loadedRef.current = true;
  }, [prefsLoaded, prefs.cashCounter]);

  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  /* ───── Open / Close helpers ───── */

  const openFromIcon = useCallback(() => {
    setSource("icon");
    setOpen(true);
  }, []);

  const openFromKeyboard = useCallback(() => {
    setSource("keyboard");
    setOpen(true);
  }, []);

  const handleOpenChange = useCallback(
    (val: boolean) => {
      if (!val) {
        // Icon mode: only close via button
        if (source === "icon") return;
        // Keyboard mode: close on outside click
        setOpen(false);
        setSource(null);
      }
    },
    [source],
  );

  const closeModal = useCallback(() => {
    setOpen(false);
    setSource(null);
  }, []);

  /* ───── F7 Keyboard shortcut ───── */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F7") {
        e.preventDefault();
        if (open) {
          closeModal();
        } else {
          openFromKeyboard();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, openFromKeyboard, closeModal]);

  /* ───── Helper: persist to user preferences ───── */

  const saveCashCounter = useCallback(
    (d: number[], c: Record<number, number>) => {
      setPrefs((prev) => ({
        ...prev,
        cashCounter: { denominations: d, counts: c },
      }));
    },
    [setPrefs],
  );

  /* ───── Counts ───── */

  const setCount = (denom: number, val: string) => {
    const n = val === "" ? 0 : parseInt(val, 10);
    if (isNaN(n) || n < 0) return;
    setCounts((prev) => {
      const next = { ...prev, [denom]: n };
      saveCashCounter(denominations, next);
      return next;
    });
  };

  const rowTotal = (denom: number) => denom * (counts[denom] || 0);

  const grandTotal = denominations.reduce((s, d) => s + rowTotal(d), 0);

  const clearAll = () => {
    setCounts({});
    saveCashCounter(denominations, {});
  };

  /* ───── Edit denominations ───── */

  const startEditDenominations = () => {
    setTempDenominations(denominations.join(", "));
    setEditingDenominations(true);
  };

  const saveDenominations = () => {
    const parsed = tempDenominations
      .split(/[,،\s]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);

    if (parsed.length === 0) return;

    const sorted = [...new Set(parsed)].sort((a, b) => b - a);
    setDenominations(sorted);
    setCounts({});
    saveCashCounter(sorted, {});
    setEditingDenominations(false);
  };

  /* ───── Print ───── */

  const handlePrint = () => {
    const rows = denominations
      .filter((d) => (counts[d] || 0) > 0)
      .map(
        (d) =>
          `<tr>
            <td style="padding:8px 16px;text-align:right;border:1px solid #ddd">${d}</td>
            <td style="padding:8px 16px;text-align:center;border:1px solid #ddd">${counts[d] || 0}</td>
            <td style="padding:8px 16px;text-align:left;border:1px solid #ddd">${rowTotal(d)}</td>
          </tr>`,
      )
      .join("");

    const html = `
      <html dir="rtl">
        <head>
          <title>عدّ النقدية</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #f3f4f6; padding: 10px 16px; border: 1px solid #ddd; }
            .total { font-size: 1.3rem; font-weight: bold; margin-top: 24px; text-align: center; }
          </style>
        </head>
        <body>
          <h2 style="text-align:center">كشف عدّ النقدية</h2>
          <p style="text-align:center;color:#666">${new Date().toLocaleDateString("ar-EG", { dateStyle: "full" })}</p>
          <table>
            <thead>
              <tr>
                <th style="text-align:right">الفئة</th>
                <th style="text-align:center">العدد</th>
                <th style="text-align:left">الإجمالي</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="total">الإجمالي الكلي: ${grandTotal} ج.م</div>
          <script>window.onload=()=>{window.print();window.close()}</script>
        </body>
      </html>
    `;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  /* ───── Navigate between inputs with Enter ───── */

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nextDenom = denominations[index + 1];
      if (nextDenom !== undefined) {
        inputRefs.current[nextDenom]?.focus();
        inputRefs.current[nextDenom]?.select();
      }
    }
  };

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */

  return (
    <>
      {/* Trigger Button (top bar) */}
      <Button
        variant="outline"
        size="icon"
        onClick={openFromIcon}
        title="عدّ النقدية (F7)"
      >
        <Calculator className="h-4 w-4" />
      </Button>

      {/* Modal */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          dir="rtl"
          className="max-w-md"
          onPointerDownOutside={(e) => {
            if (source === "icon") e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (source === "icon") e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-center text-lg">
              عدّ النقدية
            </DialogTitle>
          </DialogHeader>

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={startEditDenominations}
            >
              <Settings2 className="h-3.5 w-3.5" />
              تعديل الفئات
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs text-red-500 hover:text-red-600"
              onClick={clearAll}
            >
              <Trash2 className="h-3.5 w-3.5" />
              مسح القيم
            </Button>
          </div>

          {/* Edit Denominations */}
          {editingDenominations && (
            <div className="flex gap-2 items-center">
              <Input
                value={tempDenominations}
                onChange={(e) => setTempDenominations(e.target.value)}
                placeholder="200, 100, 50, 20, 10, 5, 1"
                className="flex-1 text-sm"
                dir="ltr"
              />
              <Button size="sm" onClick={saveDenominations}>
                حفظ
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingDenominations(false)}
              >
                إلغاء
              </Button>
            </div>
          )}

          {/* Denominations Grid */}
          <div className="space-y-2.5">
            {denominations.map((denom, idx) => (
              <div
                key={denom}
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"
              >
                {/* Denomination Label */}
                <span className="text-start font-semibold tabular-nums">
                  {denom}
                </span>

                {/* Count Input */}
                <Input
                  ref={(el) => {
                    inputRefs.current[denom] = el;
                  }}
                  type="number"
                  min={0}
                  value={counts[denom] || 0}
                  onChange={(e) => setCount(denom, e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  className="w-24 text-center tabular-nums"
                  dir="ltr"
                />

                {/* Row Total */}
                <span className="text-end text-sm text-muted-foreground tabular-nums">
                  {rowTotal(denom) || 0}
                </span>
              </div>
            ))}
          </div>

          {/* Grand Total */}
          <div className="flex items-center justify-between border-t pt-3 mt-1">
            <span className="font-bold text-sm">الإجمالي الكلي</span>
            <span
              className={`text-2xl font-black tabular-nums ${grandTotal > 0 ? "text-red-500" : "text-muted-foreground"}`}
            >
              {grandTotal}
            </span>
          </div>

          {/* Print */}
          <Button
            className="w-full gap-2"
            onClick={handlePrint}
            disabled={grandTotal === 0}
          >
            <Printer className="h-4 w-4" />
            طباعة الكشف
          </Button>

          {/* Close - only when opened from icon */}
          {source === "icon" && (
            <Button variant="outline" className="w-full" onClick={closeModal}>
              إغلاق
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
