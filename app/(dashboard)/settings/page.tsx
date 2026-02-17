"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/app/context/auth-context";
import api from "@/services/api";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  Download,
  Upload,
  Printer,
  Info,
  Bell,
  RotateCcw,
  Trash2,
  Shield,
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  Database,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import Link from "next/link";

/* ========== Section Card (collapsible) ========== */
function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  accent,
  isOpen,
  onToggle,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
  accent?: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full px-5 py-4 flex items-center gap-3 ${isOpen ? "border-b" : ""} ${accent || "bg-muted/30"} hover:opacity-90 transition-opacity cursor-pointer`}
      >
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent || "bg-primary/10"}`}
        >
          <Icon
            className={`h-5 w-5 ${accent ? "text-white" : "text-primary"}`}
          />
        </div>
        <div className="text-right flex-1">
          <h2 className="font-bold text-sm">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-muted-foreground transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <CardContent className="p-5">{children}</CardContent>
        </div>
      </div>
    </Card>
  );
}

/* ========== Component ========== */
export default function SettingsPage() {
  const { user, logout } = useAuth();

  /* ---- Print settings state ---- */
  const [autoPrint, setAutoPrint] = useState(true);
  const [showCompanyHeader, setShowCompanyHeader] = useState(true);

  /* ---- Notifications state ---- */
  const [notifSound, setNotifSound] = useState(true);
  const [notifTransfers, setNotifTransfers] = useState(true);

  /* ---- Danger zone dialogs ---- */
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showSelectiveDeleteDialog, setShowSelectiveDeleteDialog] =
    useState(false);
  const [selectedTableGroups, setSelectedTableGroups] = useState<string[]>([]);
  const [selectiveDeleting, setSelectiveDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [dangerUnlocked, setDangerUnlocked] = useState(false);
  const [dangerPassword, setDangerPassword] = useState("");
  const [dangerPasswordError, setDangerPasswordError] = useState(false);
  const [dangerChecking, setDangerChecking] = useState(false);

  /** Verify danger zone password via backend, fallback to local check */
  const verifyDangerPassword = async (password: string): Promise<boolean> => {
    try {
      await api.post("/admin/verify-danger-password", { password });
      return true;
    } catch (err: any) {
      // If endpoint doesn't exist (404), fallback to local verification
      if (err.response?.status === 404) {
        return password === "01112657552";
      }
      return false;
    }
  };

  /* ---- Load settings from localStorage ---- */
  useEffect(() => {
    const settings = localStorage.getItem("appSettings");
    if (settings) {
      try {
        const s = JSON.parse(settings);
        if (s.autoPrint !== undefined) setAutoPrint(s.autoPrint);
        if (s.showCompanyHeader !== undefined)
          setShowCompanyHeader(s.showCompanyHeader);
        if (s.notifSound !== undefined) setNotifSound(s.notifSound);
        if (s.notifTransfers !== undefined) setNotifTransfers(s.notifTransfers);
      } catch {
        /* ignore */
      }
    }
  }, []);

  /* ---- Save settings to localStorage ---- */
  const saveSettings = useCallback((partial: Record<string, boolean>) => {
    const current = localStorage.getItem("appSettings");
    const existing = current ? JSON.parse(current) : {};
    const updated = { ...existing, ...partial };
    localStorage.setItem("appSettings", JSON.stringify(updated));
  }, []);

  /* ========== Handlers ========== */

  const handleExportData = async () => {
    try {
      const res = await api.get("/admin/backup", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `glass-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("تم تصدير النسخة الاحتياطية");
    } catch {
      toast.error("فشل تصدير البيانات");
    }
  };

  const handleImportData = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const formData = new FormData();
        formData.append("file", file);
        await api.post("/admin/restore", formData);
        toast.success("تم استعادة البيانات بنجاح - سيتم إعادة تحميل الصفحة");
        setTimeout(() => window.location.reload(), 1500);
      } catch {
        toast.error("فشل استعادة البيانات");
      }
    };
    input.click();
  };

  const allTables = [
    "invoice_items",
    "invoices",
    "stock_transfer_items",
    "stock_transfers",
    "stock_movements",
    "stock",
    "cash_in",
    "cash_out",
  ];

  // مجموعات الجداول المرتبطة
  const tableGroups = [
    {
      key: "invoices",
      label: "الفواتير",
      description: "جميع فواتير البيع والشراء وعناصرها",
      tables: ["invoice_items", "invoices"],
    },
    {
      key: "transfers",
      label: "التحويلات",
      description: "فواتير التحويل بين المخازن وعناصرها",
      tables: ["stock_transfer_items", "stock_transfers"],
    },
    {
      key: "stock",
      label: "المخزون",
      description: "حركات المخزون وأرصدة الأصناف (تصفير)",
      tables: ["stock_movements", "stock"],
    },
    {
      key: "cash_in",
      label: "وارد الخزنة",
      description: "جميع سجلات الوارد",
      tables: ["cash_in"],
    },
    {
      key: "cash_out",
      label: "منصرف الخزنة",
      description: "جميع سجلات المنصرف",
      tables: ["cash_out"],
    },
    {
      key: "products",
      label: "الأصناف",
      description: "جميع الأصناف والأكواد الفرعية",
      tables: ["product_variants", "products"],
    },
  ] as const;

  const handleFactoryReset = async () => {
    if (confirmText !== "إعادة ضبط") {
      toast.error('اكتب "إعادة ضبط" للتأكيد');
      return;
    }
    try {
      await api.post(
        "/system/factory-reset",
        { tables: allTables },
        { timeout: 120000 },
      );
      toast.success("تم إعادة ضبط المصنع");
      localStorage.removeItem("appSettings");
      setTimeout(() => {
        logout();
      }, 1000);
    } catch {
      toast.error("فشل إعادة ضبط المصنع");
    }
    setShowResetDialog(false);
    setConfirmText("");
  };

  const handleClearData = async () => {
    if (confirmText !== "مسح البيانات") {
      toast.error('اكتب "مسح البيانات" للتأكيد');
      return;
    }
    try {
      await api.post(
        "/system/factory-reset",
        { tables: allTables },
        { timeout: 120000 },
      );
      toast.success("تم مسح البيانات بنجاح");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "فشل مسح البيانات");
    }
    setShowClearDialog(false);
    setConfirmText("");
  };

  const toggleTableGroup = (key: string) => {
    setSelectedTableGroups((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleSelectiveDelete = async () => {
    if (selectedTableGroups.length === 0) {
      toast.error("اختر جدول واحد على الأقل");
      return;
    }

    setSelectiveDeleting(true);
    try {
      // تجميع كل الجداول المرتبطة بالمجموعات المختارة
      const tablesToDelete = tableGroups
        .filter((g) => selectedTableGroups.includes(g.key))
        .flatMap((g) => g.tables);

      await api.post(
        "/system/factory-reset",
        { tables: tablesToDelete },
        { timeout: 120000 },
      );

      const labels = tableGroups
        .filter((g) => selectedTableGroups.includes(g.key))
        .map((g) => g.label)
        .join("، ");

      toast.success(`تم مسح: ${labels}`);
      setShowSelectiveDeleteDialog(false);
      setSelectedTableGroups([]);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "فشل مسح البيانات");
    } finally {
      setSelectiveDeleting(false);
    }
  };

  const branchLabel = (id: number) =>
    id === 1 ? "المعرض" : id === 2 ? "المخزن" : "غير محدد";

  /* ========== Section Card (collapsible) ========== */
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <PageContainer size="lg">
      <div dir="rtl" className="space-y-5 py-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">الإعدادات</h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة حسابك وإعدادات النظام
          </p>
        </div>

        {/* ═══════════════ 1. User Management Link ═══════════════ */}
        <Link href="/users">
          <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
            <div className="w-full px-5 py-4 flex items-center gap-3 bg-muted/30">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="text-right flex-1">
                <h2 className="font-bold text-sm">إدارة المستخدمين</h2>
                <p className="text-xs text-muted-foreground">
                  إضافة وحذف المستخدمين وتغيير كلمات المرور
                </p>
              </div>
              <ExternalLink className="h-5 w-5 text-muted-foreground shrink-0" />
            </div>
          </Card>
        </Link>

        {/* ═══════════════ 3. Backup & Restore ═══════════════ */}
        <SectionCard
          icon={Download}
          title="نسخ احتياطي واستعادة"
          description="تصدير واستيراد بيانات النظام"
          isOpen={openSections["backup"] ?? false}
          onToggle={() => toggleSection("backup")}
        >
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleExportData}
            >
              <Download className="h-4 w-4" />
              تصدير نسخة احتياطية
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleImportData}
            >
              <Upload className="h-4 w-4" />
              استعادة نسخة احتياطية
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            يتم تصدير جميع البيانات (أصناف، فواتير، عملاء، خزنة) في ملف واحد
          </p>
        </SectionCard>

        {/* ═══════════════ 4. Print Settings ═══════════════ */}
        <SectionCard
          icon={Printer}
          title="إعدادات الطباعة"
          description="تخصيص شكل الفواتير والتقارير عند الطباعة"
          isOpen={openSections["print"] ?? false}
          onToggle={() => toggleSection("print")}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">طباعة تلقائية</p>
                <p className="text-xs text-muted-foreground">
                  فتح نافذة الطباعة تلقائياً عند الانتقال لصفحة الطباعة
                </p>
              </div>
              <Switch
                checked={autoPrint}
                onCheckedChange={(v) => {
                  setAutoPrint(v);
                  saveSettings({ autoPrint: v });
                }}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">عنوان الشركة</p>
                <p className="text-xs text-muted-foreground">
                  إظهار اسم الشركة والعنوان في رأس الفاتورة المطبوعة
                </p>
              </div>
              <Switch
                checked={showCompanyHeader}
                onCheckedChange={(v) => {
                  setShowCompanyHeader(v);
                  saveSettings({ showCompanyHeader: v });
                }}
              />
            </div>
          </div>
        </SectionCard>

        {/* ═══════════════ 5. Notification Settings ═══════════════ */}
        <SectionCard
          icon={Bell}
          title="إعدادات الإشعارات"
          description="التحكم في الإشعارات والتنبيهات"
          isOpen={openSections["notifications"] ?? false}
          onToggle={() => toggleSection("notifications")}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">صوت الإشعارات</p>
                <p className="text-xs text-muted-foreground">
                  تشغيل صوت عند وصول إشعار جديد
                </p>
              </div>
              <Switch
                checked={notifSound}
                onCheckedChange={(v) => {
                  setNotifSound(v);
                  saveSettings({ notifSound: v });
                }}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">إشعارات التحويلات</p>
                <p className="text-xs text-muted-foreground">
                  استقبال إشعار عند تحويل بضاعة بين الفروع
                </p>
              </div>
              <Switch
                checked={notifTransfers}
                onCheckedChange={(v) => {
                  setNotifTransfers(v);
                  saveSettings({ notifTransfers: v });
                }}
              />
            </div>
          </div>
        </SectionCard>

        {/* ═══════════════ 6. System Info ═══════════════ */}
        <SectionCard
          icon={Info}
          title="معلومات النظام"
          description="إصدار التطبيق ومعلومات الحساب"
          isOpen={openSections["info"] ?? false}
          onToggle={() => toggleSection("info")}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">إصدار التطبيق</p>
              <p className="font-bold text-lg mt-1">1.0.0</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">المستخدم</p>
              <p className="font-bold text-sm mt-1">{user?.username || "—"}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">الفرع</p>
              <p className="font-bold text-sm mt-1">
                {user ? branchLabel(user.branch_id) : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">آخر دخول</p>
              <p className="font-bold text-sm mt-1">
                {new Date().toLocaleDateString("ar-EG")}
              </p>
            </div>
          </div>
        </SectionCard>

        {/* ═══════════════ 7. Danger Zone ═══════════════ */}
        <SectionCard
          icon={AlertTriangle}
          title="منطقة الخطر"
          description="عمليات لا يمكن التراجع عنها"
          accent="bg-destructive/10"
          isOpen={openSections["danger"] ?? false}
          onToggle={() => toggleSection("danger")}
        >
          {!dangerUnlocked ? (
            <div className="space-y-3">
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
                  <Shield className="h-7 w-7 text-destructive" />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  هذه المنطقة محمية بكلمة سر. أدخل كلمة السر للوصول.
                </p>
                <div className="flex gap-2 w-full max-w-xs">
                  <Input
                    type="password"
                    value={dangerPassword}
                    onChange={(e) => {
                      setDangerPassword(e.target.value);
                      setDangerPasswordError(false);
                    }}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter") {
                        setDangerChecking(true);
                        const ok = await verifyDangerPassword(dangerPassword);
                        if (ok) {
                          setDangerUnlocked(true);
                          setDangerPassword("");
                          toast.success("تم فتح منطقة الخطر");
                        } else {
                          setDangerPasswordError(true);
                          toast.error("كلمة السر غير صحيحة");
                        }
                        setDangerChecking(false);
                      }
                    }}
                    placeholder="كلمة السر"
                    className={dangerPasswordError ? "border-destructive" : ""}
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={dangerChecking}
                    onClick={async () => {
                      setDangerChecking(true);
                      const ok = await verifyDangerPassword(dangerPassword);
                      if (ok) {
                        setDangerUnlocked(true);
                        setDangerPassword("");
                        toast.success("تم فتح منطقة الخطر");
                      } else {
                        setDangerPasswordError(true);
                        toast.error("كلمة السر غير صحيحة");
                      }
                      setDangerChecking(false);
                    }}
                  >
                    {dangerChecking ? "جاري التحقق..." : "فتح"}
                  </Button>
                </div>
                {dangerPasswordError && (
                  <p className="text-xs text-destructive">
                    كلمة السر غير صحيحة
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-destructive/30 p-4">
                <div>
                  <p className="text-sm font-medium">إعادة ضبط المصنع</p>
                  <p className="text-xs text-muted-foreground">
                    إعادة جميع الإعدادات للقيم الافتراضية
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground gap-2"
                  onClick={() => {
                    setConfirmText("");
                    setShowResetDialog(true);
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  إعادة ضبط
                </Button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-destructive/30 p-4">
                <div>
                  <p className="text-sm font-medium">مسح جميع البيانات</p>
                  <p className="text-xs text-muted-foreground">
                    حذف جميع الفواتير والأصناف والعملاء نهائياً
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    setConfirmText("");
                    setShowClearDialog(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  مسح البيانات
                </Button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-orange-300 dark:border-orange-700 p-4">
                <div>
                  <p className="text-sm font-medium">مسح جدول محدد</p>
                  <p className="text-xs text-muted-foreground">
                    اختر الجداول المراد مسحها بشكل منفرد
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-orange-500 text-orange-600 hover:bg-orange-500 hover:text-white gap-2"
                  onClick={() => {
                    setSelectedTableGroups([]);
                    setShowSelectiveDeleteDialog(true);
                  }}
                >
                  <Database className="h-4 w-4" />
                  اختيار جداول
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setDangerUnlocked(false)}
              >
                قفل منطقة الخطر
              </Button>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ═══════════════ Factory Reset Dialog ═══════════════ */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <RotateCcw className="h-5 w-5" />
              إعادة ضبط المصنع
            </DialogTitle>
            <DialogDescription>
              سيتم إعادة جميع الإعدادات للقيم الافتراضية. هل أنت متأكد؟
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">
              اكتب &ldquo;إعادة ضبط&rdquo; للتأكيد
            </Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="إعادة ضبط"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowResetDialog(false)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleFactoryReset}
              disabled={confirmText !== "إعادة ضبط"}
            >
              تأكيد إعادة الضبط
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════ Clear Data Dialog ═══════════════ */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              مسح جميع البيانات
            </DialogTitle>
            <DialogDescription>
              تحذير! سيتم حذف جميع البيانات نهائياً ولا يمكن التراجع عن هذه
              العملية.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">
              اكتب &ldquo;مسح البيانات&rdquo; للتأكيد
            </Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="مسح البيانات"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowClearDialog(false)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearData}
              disabled={confirmText !== "مسح البيانات"}
            >
              تأكيد المسح
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Selective Delete Dialog */}
      <Dialog
        open={showSelectiveDeleteDialog}
        onOpenChange={setShowSelectiveDeleteDialog}
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Database className="h-5 w-5" />
              مسح جداول محددة
            </DialogTitle>
            <DialogDescription>
              اختر الجداول التي تريد مسحها. الجداول المرتبطة يتم مسحها معاً.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {tableGroups.map((group) => (
              <label
                key={group.key}
                className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={selectedTableGroups.includes(group.key)}
                  onCheckedChange={() => toggleTableGroup(group.key)}
                />
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{group.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {group.description}
                  </span>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowSelectiveDeleteDialog(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleSelectiveDelete}
              disabled={selectedTableGroups.length === 0 || selectiveDeleting}
            >
              {selectiveDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  جاري المسح...
                </>
              ) : (
                `مسح (${selectedTableGroups.length})`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
