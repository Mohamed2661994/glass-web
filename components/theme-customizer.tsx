"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Palette,
  RotateCcw,
  Check,
  Eye,
  Save,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import type { CustomColors } from "@/hooks/use-user-preferences";

/* ═══════════════ CSS Variable ↔ HEX helpers ═══════════════ */

/** Convert oklch string → hex (approximate via canvas) */
function cssColorToHex(cssValue: string): string {
  if (!cssValue || typeof document === "undefined") return "#000000";
  // If already hex
  if (cssValue.startsWith("#")) return cssValue;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "#000000";
    ctx.fillStyle = cssValue;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  } catch {
    return "#000000";
  }
}

/** Read a CSS variable from :root */
function getCSSVar(name: string): string {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Set a CSS variable on :root */
function setCSSVar(name: string, value: string) {
  document.documentElement.style.setProperty(name, value);
}

/** Remove a CSS variable override from :root */
function removeCSSVar(name: string) {
  document.documentElement.style.removeProperty(name);
}

/* ═══════════════ Editable color definitions ═══════════════ */

interface ColorDef {
  key: keyof CustomColors;
  cssVar: string;
  label: string;
  description: string;
}

const COLOR_DEFS: ColorDef[] = [
  {
    key: "background",
    cssVar: "--background",
    label: "الخلفية",
    description: "لون خلفية الصفحة الرئيسية",
  },
  {
    key: "foreground",
    cssVar: "--foreground",
    label: "النصوص",
    description: "لون النصوص العادية",
  },
  {
    key: "card",
    cssVar: "--card",
    label: "الكروت",
    description: "لون خلفية الكروت والحقول",
  },
  {
    key: "cardForeground",
    cssVar: "--card-foreground",
    label: "نص الكروت",
    description: "لون النصوص داخل الكروت",
  },
  {
    key: "primary",
    cssVar: "--primary",
    label: "اللون الرئيسي",
    description: "لون الأزرار والعناصر المميزة",
  },
  {
    key: "primaryForeground",
    cssVar: "--primary-foreground",
    label: "نص الأزرار",
    description: "لون النص داخل الأزرار الرئيسية",
  },
  {
    key: "secondary",
    cssVar: "--secondary",
    label: "اللون الثانوي",
    description: "خلفية العناصر الثانوية",
  },
  {
    key: "muted",
    cssVar: "--muted",
    label: "العناصر المعتمة",
    description: "لون خلفية العناصر الخفيفة",
  },
  {
    key: "mutedForeground",
    cssVar: "--muted-foreground",
    label: "نص معتم",
    description: "لون النصوص الثانوية",
  },
  {
    key: "border",
    cssVar: "--border",
    label: "الحدود",
    description: "لون حدود العناصر",
  },
  {
    key: "accent",
    cssVar: "--accent",
    label: "لون التمييز",
    description: "خلفية العناصر عند التحويم",
  },
  {
    key: "destructive",
    cssVar: "--destructive",
    label: "لون التحذير",
    description: "لون أزرار الحذف والتحذيرات",
  },
];

/* ═══════════════ Preset themes ═══════════════ */

interface ThemePreset {
  name: string;
  light: Partial<CustomColors>;
  dark: Partial<CustomColors>;
}

const PRESETS: ThemePreset[] = [
  {
    name: "أزرق كلاسيكي",
    light: {
      primary: "#2563eb",
      primaryForeground: "#ffffff",
      accent: "#dbeafe",
      background: "#f8fafc",
    },
    dark: {
      primary: "#3b82f6",
      primaryForeground: "#ffffff",
      accent: "#1e3a5f",
      background: "#0f172a",
    },
  },
  {
    name: "أخضر طبيعي",
    light: {
      primary: "#16a34a",
      primaryForeground: "#ffffff",
      accent: "#dcfce7",
      background: "#f0fdf4",
    },
    dark: {
      primary: "#22c55e",
      primaryForeground: "#ffffff",
      accent: "#14532d",
      background: "#052e16",
    },
  },
  {
    name: "بنفسجي أنيق",
    light: {
      primary: "#7c3aed",
      primaryForeground: "#ffffff",
      accent: "#ede9fe",
      background: "#faf5ff",
    },
    dark: {
      primary: "#8b5cf6",
      primaryForeground: "#ffffff",
      accent: "#3b0764",
      background: "#1e1b4b",
    },
  },
  {
    name: "برتقالي دافئ",
    light: {
      primary: "#ea580c",
      primaryForeground: "#ffffff",
      accent: "#fff7ed",
      background: "#fffbeb",
    },
    dark: {
      primary: "#f97316",
      primaryForeground: "#ffffff",
      accent: "#431407",
      background: "#1c1917",
    },
  },
  {
    name: "وردي ناعم",
    light: {
      primary: "#db2777",
      primaryForeground: "#ffffff",
      accent: "#fce7f3",
      background: "#fdf2f8",
    },
    dark: {
      primary: "#ec4899",
      primaryForeground: "#ffffff",
      accent: "#500724",
      background: "#1a0a14",
    },
  },
  {
    name: "تركواز",
    light: {
      primary: "#0891b2",
      primaryForeground: "#ffffff",
      accent: "#cffafe",
      background: "#ecfeff",
    },
    dark: {
      primary: "#06b6d4",
      primaryForeground: "#ffffff",
      accent: "#164e63",
      background: "#0c1a25",
    },
  },
];

/* ═══════════════ Component ═══════════════ */

export function ThemeCustomizer() {
  const { resolvedTheme } = useTheme();
  const { prefs, setPrefs } = useUserPreferences();
  const isDark = resolvedTheme === "dark";
  const mode = isDark ? "dark" : "light";

  // Draft colors (for preview — not saved yet)
  const [draft, setDraft] = useState<Partial<CustomColors>>({});
  const [previewing, setPreviewing] = useState(false);
  const [originalValues, setOriginalValues] = useState<Record<string, string>>(
    {},
  );

  // Read current CSS var values as hex
  const currentHexValues = useMemo(() => {
    const vals: Record<string, string> = {};
    if (typeof document === "undefined") return vals;
    for (const def of COLOR_DEFS) {
      vals[def.key] = cssColorToHex(getCSSVar(def.cssVar));
    }
    return vals;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTheme, previewing]);

  // Initialize draft from saved prefs
  useEffect(() => {
    const saved = prefs.customColors?.[mode];
    if (saved) {
      setDraft(saved);
    } else {
      setDraft({});
    }
  }, [mode, prefs.customColors]);

  // Apply saved colors on theme change
  useEffect(() => {
    const saved = prefs.customColors?.[mode];
    if (saved) {
      for (const def of COLOR_DEFS) {
        if (saved[def.key]) {
          setCSSVar(def.cssVar, saved[def.key]!);
        }
      }
    }
  }, [mode, prefs.customColors]);

  const updateDraftColor = useCallback(
    (key: keyof CustomColors, value: string) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handlePreview = useCallback(() => {
    // Save original values before preview
    const originals: Record<string, string> = {};
    for (const def of COLOR_DEFS) {
      originals[def.cssVar] = getCSSVar(def.cssVar);
    }
    setOriginalValues(originals);

    // Apply draft to CSS
    for (const def of COLOR_DEFS) {
      if (draft[def.key]) {
        setCSSVar(def.cssVar, draft[def.key]!);
      }
    }
    setPreviewing(true);
    toast.info("وضع المعاينة — شوف التغييرات وأكّد أو ارجع");
  }, [draft]);

  const handleCancelPreview = useCallback(() => {
    // Revert to original values
    for (const def of COLOR_DEFS) {
      if (originalValues[def.cssVar]) {
        setCSSVar(def.cssVar, originalValues[def.cssVar]);
      } else {
        removeCSSVar(def.cssVar);
      }
    }
    // Re-apply saved if exists
    const saved = prefs.customColors?.[mode];
    if (saved) {
      for (const def of COLOR_DEFS) {
        if (saved[def.key]) {
          setCSSVar(def.cssVar, saved[def.key]!);
        }
      }
    }
    setPreviewing(false);
    toast.info("تم إلغاء المعاينة");
  }, [originalValues, prefs.customColors, mode]);

  const handleSave = useCallback(() => {
    // Keep draft applied and save to prefs
    const newCustomColors = {
      ...(prefs.customColors || {}),
      [mode]: { ...draft },
    };
    setPrefs((prev) => ({ ...prev, customColors: newCustomColors }));
    setPreviewing(false);
    toast.success("تم حفظ الألوان بنجاح ✨");
  }, [draft, mode, prefs.customColors, setPrefs]);

  const handleReset = useCallback(() => {
    // Remove all custom CSS vars
    for (const def of COLOR_DEFS) {
      removeCSSVar(def.cssVar);
    }
    // Clear saved colors for current mode
    const newCustomColors = { ...(prefs.customColors || {}) };
    delete newCustomColors[mode];
    setPrefs((prev) => ({ ...prev, customColors: newCustomColors }));
    setDraft({});
    setPreviewing(false);
    toast.success("تم إعادة الألوان للافتراضي");
  }, [mode, prefs.customColors, setPrefs]);

  const applyPreset = useCallback(
    (preset: ThemePreset) => {
      const colors = isDark ? preset.dark : preset.light;
      setDraft((prev) => ({ ...prev, ...colors }));
      // Apply immediately for preview
      for (const def of COLOR_DEFS) {
        const val = colors[def.key];
        if (val) setCSSVar(def.cssVar, val);
      }
      setPreviewing(true);
      toast.info(`تم تطبيق ثيم "${preset.name}" — أكّد لحفظه`);
    },
    [isDark],
  );

  const hasDraft = Object.keys(draft).length > 0;

  return (
    <div className="space-y-5">
      {/* Preset themes */}
      <div>
        <Label className="text-sm font-medium mb-3 block">
          ثيمات جاهزة
        </Label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {PRESETS.map((preset) => {
            const colors = isDark ? preset.dark : preset.light;
            return (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className="flex flex-col items-center gap-1.5 rounded-lg border p-2 hover:bg-muted/50 transition-colors"
              >
                <div className="flex gap-0.5">
                  <div
                    className="w-5 h-5 rounded-full border"
                    style={{ backgroundColor: colors.primary || "#000" }}
                  />
                  <div
                    className="w-5 h-5 rounded-full border"
                    style={{
                      backgroundColor: colors.background || colors.accent || "#eee",
                    }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground leading-tight text-center">
                  {preset.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Individual color pickers */}
      <div>
        <Label className="text-sm font-medium mb-3 block">
          تخصيص يدوي
        </Label>
        <div className="grid gap-3">
          {COLOR_DEFS.map((def) => {
            const draftVal = draft[def.key];
            const currentVal = draftVal || currentHexValues[def.key] || "#000000";
            return (
              <div
                key={def.key}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <label className="relative shrink-0 cursor-pointer">
                  <input
                    type="color"
                    value={currentVal}
                    onChange={(e) => updateDraftColor(def.key, e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div
                    className="w-10 h-10 rounded-lg border-2 border-muted-foreground/20"
                    style={{ backgroundColor: currentVal }}
                  />
                </label>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{def.label}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {def.description}
                  </p>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                  {currentVal.toUpperCase()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Preview section */}
      <div>
        <Label className="text-sm font-medium mb-3 block">معاينة</Label>
        <div className="rounded-xl border p-4 space-y-3">
          {/* Mini dashboard preview */}
          <div className="flex gap-2">
            <div
              className="flex-1 rounded-lg p-3 border"
              style={{
                backgroundColor: draft.card || currentHexValues.card,
                color: draft.cardForeground || currentHexValues.cardForeground,
                borderColor: draft.border || currentHexValues.border,
              }}
            >
              <p className="text-xs opacity-60">إجمالي المبيعات</p>
              <p className="text-lg font-bold">٣,٥٠٠ ج</p>
            </div>
            <div
              className="flex-1 rounded-lg p-3 border"
              style={{
                backgroundColor: draft.card || currentHexValues.card,
                color: draft.cardForeground || currentHexValues.cardForeground,
                borderColor: draft.border || currentHexValues.border,
              }}
            >
              <p className="text-xs opacity-60">عدد الفواتير</p>
              <p className="text-lg font-bold">١٢</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className="flex-1 rounded-lg px-4 py-2 text-sm font-medium"
              style={{
                backgroundColor: draft.primary || currentHexValues.primary,
                color:
                  draft.primaryForeground || currentHexValues.primaryForeground,
              }}
            >
              زر رئيسي
            </button>
            <button
              className="flex-1 rounded-lg px-4 py-2 text-sm font-medium border"
              style={{
                backgroundColor: draft.secondary || currentHexValues.secondary,
                color: draft.foreground || currentHexValues.foreground,
                borderColor: draft.border || currentHexValues.border,
              }}
            >
              زر ثانوي
            </button>
            <button
              className="flex-1 rounded-lg px-4 py-2 text-sm font-medium"
              style={{
                backgroundColor:
                  draft.destructive || currentHexValues.destructive,
                color: "#fff",
              }}
            >
              حذف
            </button>
          </div>
          <div
            className="rounded-lg p-2 text-xs"
            style={{
              backgroundColor: draft.muted || currentHexValues.muted,
              color:
                draft.mutedForeground || currentHexValues.mutedForeground,
            }}
          >
            هذا نص ثانوي لاختبار الألوان المعتمة
          </div>
        </div>
      </div>

      <Separator />

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {!previewing ? (
          <Button
            onClick={handlePreview}
            disabled={!hasDraft}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            معاينة على الصفحة
          </Button>
        ) : (
          <>
            <Button onClick={handleSave} className="gap-2">
              <Save className="h-4 w-4" />
              حفظ الألوان
            </Button>
            <Button
              variant="outline"
              onClick={handleCancelPreview}
              className="gap-2"
            >
              إلغاء المعاينة
            </Button>
          </>
        )}
        <Button variant="ghost" onClick={handleReset} className="gap-2 mr-auto">
          <RotateCcw className="h-4 w-4" />
          إعادة للافتراضي
        </Button>
      </div>

      {previewing && (
        <Badge variant="secondary" className="w-full justify-center py-1.5">
          <Eye className="h-3.5 w-3.5 ml-1.5" />
          وضع المعاينة — التغييرات مؤقتة حتى تحفظها
        </Badge>
      )}
    </div>
  );
}
