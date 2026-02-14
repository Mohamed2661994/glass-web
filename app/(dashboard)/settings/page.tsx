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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  KeyRound,
  Users,
  Download,
  Upload,
  Printer,
  Info,
  Bell,
  RotateCcw,
  Trash2,
  Shield,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  UserPlus,
  Pencil,
  Trash,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

/* ========== Types ========== */
type ManagedUser = {
  id: number;
  username: string;
  branch_id: number;
};

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

  /* ---- Change password state ---- */
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  /* ---- User management state ---- */
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserBranch, setNewUserBranch] = useState(1);
  const [addingUser, setAddingUser] = useState(false);

  /* ---- Print settings state ---- */
  const [autoPrint, setAutoPrint] = useState(true);
  const [showCompanyHeader, setShowCompanyHeader] = useState(true);

  /* ---- Notifications state ---- */
  const [notifSound, setNotifSound] = useState(true);
  const [notifTransfers, setNotifTransfers] = useState(true);

  /* ---- Danger zone dialogs ---- */
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [dangerUnlocked, setDangerUnlocked] = useState(false);
  const [dangerPassword, setDangerPassword] = useState("");
  const [dangerPasswordError, setDangerPasswordError] = useState(false);
  const DANGER_ZONE_PASSWORD = "01112657552";

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

  /* ---- Fetch users ---- */
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await api.get("/users");
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch {
      /* ignore */
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  /* ========== Handlers ========== */

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error("أدخل كلمة المرور الحالية والجديدة");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("كلمة المرور الجديدة غير متطابقة");
      return;
    }
    if (newPassword.length < 4) {
      toast.error("كلمة المرور يجب أن تكون 4 أحرف على الأقل");
      return;
    }
    setChangingPassword(true);
    try {
      await api.put(`/users/${user?.id}/password`, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success("تم تغيير كلمة المرور بنجاح");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error("فشل تغيير كلمة المرور - تأكد من كلمة المرور الحالية");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUsername || !newUserPassword) {
      toast.error("أدخل اسم المستخدم وكلمة المرور");
      return;
    }
    setAddingUser(true);
    try {
      await api.post("/users", {
        username: newUsername,
        password: newUserPassword,
        branch_id: newUserBranch,
      });
      toast.success("تم إضافة المستخدم بنجاح");
      setNewUsername("");
      setNewUserPassword("");
      setShowAddUser(false);
      fetchUsers();
    } catch {
      toast.error("فشل إضافة المستخدم");
    } finally {
      setAddingUser(false);
    }
  };

  const handleDeleteUser = async (id: number, username: string) => {
    if (id === user?.id) {
      toast.error("لا يمكنك حذف حسابك الحالي");
      return;
    }
    if (!confirm(`هل أنت متأكد من حذف المستخدم "${username}"؟`)) return;
    try {
      await api.delete(`/users/${id}`);
      toast.success("تم حذف المستخدم");
      fetchUsers();
    } catch (err: any) {
      console.error(
        "Delete user error:",
        err.response?.status,
        err.response?.data,
        err.message,
      );
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "فشل حذف المستخدم";
      toast.error(msg);
    }
  };

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
      console.error(
        "Clear data error:",
        err.response?.status,
        err.response?.data,
        err.message,
      );
      toast.error(err.response?.data?.error || "فشل مسح البيانات");
    }
    setShowClearDialog(false);
    setConfirmText("");
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

        {/* ═══════════════ 1. Change Password ═══════════════ */}
        <SectionCard
          icon={KeyRound}
          title="تغيير كلمة المرور"
          description="تغيير كلمة مرور حسابك الحالي"
          isOpen={openSections["password"] ?? false}
          onToggle={() => toggleSection("password")}
        >
          <div className="space-y-3 max-w-md">
            <div className="space-y-1">
              <Label className="text-xs">كلمة المرور الحالية</Label>
              <div className="relative">
                <Input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showCurrent ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">كلمة المرور الجديدة</Label>
              <div className="relative">
                <Input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showNew ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">تأكيد كلمة المرور الجديدة</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">
                  كلمة المرور غير متطابقة
                </p>
              )}
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={changingPassword}
              className="gap-2"
            >
              {changingPassword ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              حفظ كلمة المرور
            </Button>
          </div>
        </SectionCard>

        {/* ═══════════════ 2. User Management ═══════════════ */}
        <SectionCard
          icon={Users}
          title="إدارة المستخدمين"
          description="إضافة وحذف المستخدمين وإدارة الصلاحيات"
          isOpen={openSections["users"] ?? false}
          onToggle={() => toggleSection("users")}
        >
          <div className="space-y-4">
            {/* Users List */}
            {loadingUsers ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded-lg border px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                        <Shield className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{u.username}</p>
                        <p className="text-xs text-muted-foreground">
                          {branchLabel(u.branch_id)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={u.id === user?.id ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {u.id === user?.id ? "أنت" : "مستخدم"}
                      </Badge>
                      {u.id !== user?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteUser(u.id, u.username)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add User */}
            {!showAddUser ? (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setShowAddUser(true)}
              >
                <UserPlus className="h-4 w-4" />
                إضافة مستخدم جديد
              </Button>
            ) : (
              <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">اسم المستخدم</Label>
                    <Input
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="username"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">كلمة المرور</Label>
                    <Input
                      type="password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="••••••"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">الفرع</Label>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={newUserBranch}
                      onChange={(e) => setNewUserBranch(Number(e.target.value))}
                    >
                      <option value={1}>المعرض (قطاعي)</option>
                      <option value={2}>المخزن (جملة)</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleAddUser}
                    disabled={addingUser}
                    size="sm"
                    className="gap-1"
                  >
                    {addingUser ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <UserPlus className="h-3 w-3" />
                    )}
                    إضافة
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAddUser(false);
                      setNewUsername("");
                      setNewUserPassword("");
                    }}
                  >
                    إلغاء
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SectionCard>

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
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (dangerPassword === DANGER_ZONE_PASSWORD) {
                          setDangerUnlocked(true);
                          setDangerPassword("");
                          toast.success("تم فتح منطقة الخطر");
                        } else {
                          setDangerPasswordError(true);
                          toast.error("كلمة السر غير صحيحة");
                        }
                      }
                    }}
                    placeholder="كلمة السر"
                    className={dangerPasswordError ? "border-destructive" : ""}
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (dangerPassword === DANGER_ZONE_PASSWORD) {
                        setDangerUnlocked(true);
                        setDangerPassword("");
                        toast.success("تم فتح منطقة الخطر");
                      } else {
                        setDangerPasswordError(true);
                        toast.error("كلمة السر غير صحيحة");
                      }
                    }}
                  >
                    فتح
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
    </PageContainer>
  );
}
