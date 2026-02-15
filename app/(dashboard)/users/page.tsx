"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/app/context/auth-context";
import api from "@/services/api";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Shield,
  Eye,
  EyeOff,
  CheckCircle2,
  Loader2,
  UserPlus,
  Trash,
  ChevronDown,
  Lock,
  Pencil,
  User,
} from "lucide-react";
import { toast } from "sonner";

/* ========== Constants ========== */
const ADMIN_USER_ID = 7;

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
export default function UsersPage() {
  const { user, setUser } = useAuth();
  const isAdmin = user?.id === ADMIN_USER_ID;

  /* ---- Edit username state ---- */
  const [editingName, setEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);

  /* ---- Change password state ---- */
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  /* ---- User management state (admin only) ---- */
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserBranch, setNewUserBranch] = useState(1);
  const [addingUser, setAddingUser] = useState(false);

  /* ---- Reset password dialog (admin only) ---- */
  const [resetDialog, setResetDialog] = useState<{
    open: boolean;
    userId: number;
    username: string;
  }>({ open: false, userId: 0, username: "" });
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  /* ---- Collapsible sections ---- */
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    profile: true,
    password: false,
    users: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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
    if (isAdmin) fetchUsers();
  }, [isAdmin, fetchUsers]);

  /* ========== Handlers ========== */

  const handleUpdateUsername = async () => {
    if (!newDisplayName.trim()) {
      toast.error("أدخل اسم المستخدم الجديد");
      return;
    }
    setSavingName(true);
    try {
      const res = await api.put(`/users/${user?.id}/username`, {
        new_username: newDisplayName.trim(),
      });
      toast.success("تم تحديث اسم المستخدم بنجاح");
      if (user) {
        const updated = {
          ...user,
          username: res.data.username || newDisplayName.trim(),
        };
        setUser(updated);
        localStorage.setItem("user", JSON.stringify(updated));
      }
      setEditingName(false);
      if (isAdmin) fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "فشل تحديث اسم المستخدم");
    } finally {
      setSavingName(false);
    }
  };

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
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "فشل حذف المستخدم";
      toast.error(msg);
    }
  };

  const handleResetPassword = async () => {
    if (!resetNewPassword) {
      toast.error("أدخل كلمة المرور الجديدة");
      return;
    }
    if (resetNewPassword.length < 4) {
      toast.error("كلمة المرور يجب أن تكون 4 أحرف على الأقل");
      return;
    }
    setResettingPassword(true);
    try {
      await api.put(`/users/${resetDialog.userId}/reset-password`, {
        new_password: resetNewPassword,
      });
      toast.success(`تم إعادة تعيين كلمة مرور "${resetDialog.username}" بنجاح`);
      setResetDialog({ open: false, userId: 0, username: "" });
      setResetNewPassword("");
    } catch {
      toast.error("فشل إعادة تعيين كلمة المرور");
    } finally {
      setResettingPassword(false);
    }
  };

  const branchLabel = (id: number) =>
    id === 1 ? "المعرض" : id === 2 ? "المخزن" : "غير محدد";

  return (
    <PageContainer size="lg">
      <div dir="rtl" className="space-y-5 py-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">
            {isAdmin ? "إدارة المستخدمين" : "حسابي"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin
              ? "إدارة حسابك والمستخدمين الآخرين"
              : "إدارة بيانات حسابك الشخصي"}
          </p>
        </div>

        {/* ═══════════════ 1. Profile (Edit Username) ═══════════════ */}
        <SectionCard
          icon={User}
          title="الملف الشخصي"
          description="عرض وتعديل بيانات حسابك"
          isOpen={openSections["profile"] ?? false}
          onToggle={() => toggleSection("profile")}
        >
          <div className="space-y-4 max-w-md">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1">
                {!editingName ? (
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="font-bold text-lg">
                        {user?.username || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {user ? branchLabel(user.branch_id) : "—"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => {
                        setNewDisplayName(user?.username || "");
                        setEditingName(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      className="h-9"
                      placeholder="اسم المستخدم الجديد"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleUpdateUsername();
                        if (e.key === "Escape") setEditingName(false);
                      }}
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={handleUpdateUsername}
                      disabled={savingName}
                      className="gap-1"
                    >
                      {savingName ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      حفظ
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingName(false)}
                    >
                      إلغاء
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ═══════════════ 2. Change Password ═══════════════ */}
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

        {/* ═══════════════ 3. User Management (Admin Only) ═══════════════ */}
        {isAdmin && (
          <SectionCard
            icon={Users}
            title="المستخدمين"
            description="إضافة وحذف المستخدمين وإعادة تعيين كلمات المرور"
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
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              title="إعادة تعيين كلمة المرور"
                              onClick={() =>
                                setResetDialog({
                                  open: true,
                                  userId: u.id,
                                  username: u.username,
                                })
                              }
                            >
                              <Lock className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteUser(u.id, u.username)}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </>
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
                        onChange={(e) =>
                          setNewUserBranch(Number(e.target.value))
                        }
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
        )}
      </div>

      {/* ═══════════════ Reset Password Dialog ═══════════════ */}
      {isAdmin && (
        <Dialog
          open={resetDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              setResetDialog({ open: false, userId: 0, username: "" });
              setResetNewPassword("");
            }
          }}
        >
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                إعادة تعيين كلمة المرور
              </DialogTitle>
              <DialogDescription>
                إعادة تعيين كلمة مرور المستخدم &ldquo;{resetDialog.username}
                &rdquo;
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label className="text-xs">كلمة المرور الجديدة</Label>
              <Input
                type="password"
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                placeholder="••••••"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleResetPassword();
                }}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setResetDialog({ open: false, userId: 0, username: "" });
                  setResetNewPassword("");
                }}
              >
                إلغاء
              </Button>
              <Button
                onClick={handleResetPassword}
                disabled={resettingPassword || !resetNewPassword}
                className="gap-2"
              >
                {resettingPassword ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                تعيين كلمة المرور
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </PageContainer>
  );
}
