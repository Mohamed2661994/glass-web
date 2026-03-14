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
import { useRealtime } from "@/hooks/use-realtime";
import { Skeleton } from "@/components/ui/skeleton";
import {
  defaultPermissions,
  isAdminUser,
  normalizePermissions,
  permissionKeys,
  permissionLabels,
  summarizePermissions,
  type PermissionKey,
  type UserPermissions,
} from "@/lib/permissions";

/* ========== Admin check uses backend role ========== */

/* ========== Types ========== */
type ManagedUser = {
  id: number;
  username: string;
  branch_id: number;
  full_name?: string;
  role?: string;
  permissions?: Partial<UserPermissions>;
};

type AccessDialogState = {
  open: boolean;
  userId: number;
  username: string;
  full_name: string;
  branch_id: number;
  role: "admin" | "user";
  permissions: UserPermissions;
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
  const { user, setUser, authReady } = useAuth();
  const isAdmin = authReady && isAdminUser(user);
  const canManageAllBranches = authReady && user?.id === 7;

  /* ---- Edit username state ---- */
  const [editingName, setEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);

  /* ---- Edit full name state ---- */
  const [editingFullName, setEditingFullName] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [savingFullName, setSavingFullName] = useState(false);

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
  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "user">("user");
  const [newUserPermissions, setNewUserPermissions] =
    useState<UserPermissions>(defaultPermissions);
  const [addingUser, setAddingUser] = useState(false);

  const [accessDialog, setAccessDialog] = useState<AccessDialogState>({
    open: false,
    userId: 0,
    username: "",
    full_name: "",
    branch_id: 1,
    role: "user",
    permissions: defaultPermissions,
  });
  const [savingAccess, setSavingAccess] = useState(false);

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

  const resetNewUserForm = () => {
    setNewUsername("");
    setNewUserPassword("");
    setNewUserFullName("");
    setNewUserBranch(1);
    setNewUserRole("user");
    setNewUserPermissions(defaultPermissions);
  };

  const handleNewUserPermissionToggle = (permission: PermissionKey) => {
    setNewUserPermissions((prev) => ({
      ...prev,
      [permission]: !prev[permission],
    }));
  };

  const handleAccessPermissionToggle = (permission: PermissionKey) => {
    setAccessDialog((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permission]: !prev.permissions[permission],
      },
    }));
  };

  const openAccessDialog = (managedUser: ManagedUser) => {
    setAccessDialog({
      open: true,
      userId: managedUser.id,
      username: managedUser.username,
      full_name: managedUser.full_name || "",
      branch_id: managedUser.branch_id,
      role: managedUser.role === "admin" ? "admin" : "user",
      permissions: normalizePermissions(managedUser.permissions),
    });
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

  useEffect(() => {
    if (!canManageAllBranches && user?.branch_id) {
      setNewUserBranch(user.branch_id);
    }
  }, [canManageAllBranches, user?.branch_id]);

  useRealtime("data:users", fetchUsers);

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

  const handleUpdateFullName = async () => {
    setSavingFullName(true);
    try {
      const res = await api.put(`/users/${user?.id}/full-name`, {
        full_name: newFullName.trim(),
      });
      toast.success("تم تحديث الاسم بالكامل بنجاح");
      if (user) {
        const updated = {
          ...user,
          full_name: res.data.full_name ?? newFullName.trim(),
        };
        setUser(updated);
        localStorage.setItem("user", JSON.stringify(updated));
      }
      setEditingFullName(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "فشل تحديث الاسم");
    } finally {
      setSavingFullName(false);
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
        full_name: newUserFullName,
        role: newUserRole,
        permissions: newUserPermissions,
      });
      toast.success("تم إضافة المستخدم بنجاح");
      resetNewUserForm();
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

  const handleSaveAccess = async () => {
    setSavingAccess(true);
    try {
      await api.put(`/users/${accessDialog.userId}/access`, {
        full_name: accessDialog.full_name,
        branch_id: accessDialog.branch_id,
        role: accessDialog.role,
        permissions: accessDialog.permissions,
      });
      toast.success(`تم تحديث صلاحيات المستخدم "${accessDialog.username}"`);
      setAccessDialog((prev) => ({ ...prev, open: false }));
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "فشل تحديث صلاحيات المستخدم");
    } finally {
      setSavingAccess(false);
    }
  };

  const branchLabel = (id: number) =>
    id === 1 ? "المعرض" : id === 2 ? "المخزن" : "غير محدد";

  const roleLabel = (role?: string) => (role === "admin" ? "أدمن" : "مستخدم");

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
              <div className="flex-1 space-y-2">
                {/* Full Name */}
                {!editingFullName ? (
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="font-bold text-lg">
                        {user?.full_name || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        الاسم بالكامل
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => {
                        setNewFullName(user?.full_name || "");
                        setEditingFullName(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                      className="h-9"
                      placeholder="الاسم بالكامل"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleUpdateFullName();
                        if (e.key === "Escape") setEditingFullName(false);
                      }}
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={handleUpdateFullName}
                      disabled={savingFullName}
                      className="gap-1"
                    >
                      {savingFullName ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" />
                      )}
                      حفظ
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingFullName(false)}
                    >
                      إلغاء
                    </Button>
                  </div>
                )}

                {/* Username */}
                {!editingName ? (
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="font-medium text-sm text-muted-foreground">
                        {user?.username || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        اسم المستخدم •{" "}
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
          <div className="space-y-4 max-w-md">
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
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
            description="إضافة المستخدمين وتحديد الدور والصلاحيات وإعادة تعيين كلمات المرور"
            isOpen={openSections["users"] ?? false}
            onToggle={() => toggleSection("users")}
          >
            <div className="space-y-4">
              {/* Users List */}
              {loadingUsers ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-9 h-9 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-32" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-16 rounded-full" />
                        <Skeleton className="h-8 w-8 rounded" />
                      </div>
                    </div>
                  ))}
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
                          <p className="font-medium text-sm">
                            {u.full_name || u.username}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {u.username} • {branchLabel(u.branch_id)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {summarizePermissions(u.role, u.permissions)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={u.id === user?.id ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {u.id === user?.id ? "أنت" : roleLabel(u.role)}
                        </Badge>
                        {u.id !== user?.id && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              title="تعديل الدور والصلاحيات"
                              onClick={() => openAccessDialog(u)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
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
                <div className="rounded-lg border p-4 space-y-4 bg-muted/20">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">اسم المستخدم</Label>
                      <Input
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="username"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">الاسم بالكامل</Label>
                      <Input
                        value={newUserFullName}
                        onChange={(e) => setNewUserFullName(e.target.value)}
                        placeholder="الاسم بالكامل"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">كلمة المرور</Label>
                      <Input
                        type="password"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        placeholder="••••••"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">الفرع</Label>
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={newUserBranch}
                        disabled={!canManageAllBranches}
                        onChange={(e) =>
                          setNewUserBranch(Number(e.target.value))
                        }
                      >
                        <option value={1}>المعرض (قطاعي)</option>
                        <option value={2}>المخزن (جملة)</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">الدور</Label>
                      <select
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                        value={newUserRole}
                        onChange={(e) =>
                          setNewUserRole(
                            e.target.value === "admin" ? "admin" : "user",
                          )
                        }
                      >
                        <option value="user">مستخدم</option>
                        <option value="admin">أدمن</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-3 rounded-lg border p-3 bg-background/60">
                    <div>
                      <p className="text-sm font-medium">
                        صلاحيات التعديل والحذف
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {newUserRole === "admin"
                          ? "الأدمن يمتلك كل الصلاحيات تلقائيًا داخل فرعه."
                          : "حدد ما يمكن للمستخدم فعله في الفواتير والوارد والمنصرف."}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {permissionKeys.map((permission) => (
                        <label
                          key={permission}
                          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                        >
                          <Checkbox
                            checked={newUserPermissions[permission]}
                            disabled={newUserRole === "admin"}
                            onCheckedChange={() =>
                              handleNewUserPermissionToggle(permission)
                            }
                          />
                          <span>{permissionLabels[permission]}</span>
                        </label>
                      ))}
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
                        resetNewUserForm();
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

      {isAdmin && (
        <Dialog
          open={accessDialog.open}
          onOpenChange={(open) =>
            setAccessDialog((prev) => ({ ...prev, open }))
          }
        >
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>تعديل دور وصلاحيات المستخدم</DialogTitle>
              <DialogDescription>
                ضبط الفرع والدور وصلاحيات المستخدم &ldquo;
                {accessDialog.username}
                &rdquo;
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">الاسم بالكامل</Label>
                <Input
                  value={accessDialog.full_name}
                  onChange={(e) =>
                    setAccessDialog((prev) => ({
                      ...prev,
                      full_name: e.target.value,
                    }))
                  }
                  placeholder="الاسم بالكامل"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">الفرع</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={accessDialog.branch_id}
                    disabled={!canManageAllBranches}
                    onChange={(e) =>
                      setAccessDialog((prev) => ({
                        ...prev,
                        branch_id: Number(e.target.value),
                      }))
                    }
                  >
                    <option value={1}>المعرض (قطاعي)</option>
                    <option value={2}>المخزن (جملة)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">الدور</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={accessDialog.role}
                    onChange={(e) =>
                      setAccessDialog((prev) => ({
                        ...prev,
                        role: e.target.value === "admin" ? "admin" : "user",
                      }))
                    }
                  >
                    <option value="user">مستخدم</option>
                    <option value="admin">أدمن</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border p-3 bg-muted/10">
                <div>
                  <p className="text-sm font-medium">صلاحيات التعديل والحذف</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {accessDialog.role === "admin"
                      ? "الأدمن يمتلك كل الصلاحيات تلقائيًا داخل فرعه."
                      : "اختر صلاحيات تعديل وحذف الفواتير وقيود الوارد والمنصرف."}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {permissionKeys.map((permission) => (
                    <label
                      key={permission}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={accessDialog.permissions[permission]}
                        disabled={accessDialog.role === "admin"}
                        onCheckedChange={() =>
                          handleAccessPermissionToggle(permission)
                        }
                      />
                      <span>{permissionLabels[permission]}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="ghost"
                onClick={() =>
                  setAccessDialog((prev) => ({ ...prev, open: false }))
                }
              >
                إلغاء
              </Button>
              <Button onClick={handleSaveAccess} disabled={savingAccess}>
                {savingAccess ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "حفظ الصلاحيات"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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
