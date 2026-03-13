export const permissionKeys = [
  "cash_in_edit",
  "cash_in_delete",
  "cash_out_edit",
  "cash_out_delete",
  "invoice_edit",
  "invoice_delete",
] as const;

export type PermissionKey = (typeof permissionKeys)[number];

export type UserPermissions = Record<PermissionKey, boolean>;

export const defaultPermissions: UserPermissions = {
  cash_in_edit: false,
  cash_in_delete: false,
  cash_out_edit: false,
  cash_out_delete: false,
  invoice_edit: false,
  invoice_delete: false,
};

export const permissionLabels: Record<PermissionKey, string> = {
  cash_in_edit: "تعديل الوارد",
  cash_in_delete: "حذف الوارد",
  cash_out_edit: "تعديل المنصرف",
  cash_out_delete: "حذف المنصرف",
  invoice_edit: "تعديل الفاتورة",
  invoice_delete: "حذف الفاتورة",
};

export function normalizePermissions(
  permissions?: Partial<UserPermissions> | null,
): UserPermissions {
  return {
    cash_in_edit: Boolean(permissions?.cash_in_edit),
    cash_in_delete: Boolean(permissions?.cash_in_delete),
    cash_out_edit: Boolean(permissions?.cash_out_edit),
    cash_out_delete: Boolean(permissions?.cash_out_delete),
    invoice_edit: Boolean(permissions?.invoice_edit),
    invoice_delete: Boolean(permissions?.invoice_delete),
  };
}

export function isAdminUser(user?: { id?: number; role?: string } | null) {
  return user?.id === 7 || user?.role === "admin";
}

export function hasPermission(
  user:
    | {
        id?: number;
        role?: string;
        permissions?: Partial<UserPermissions> | null;
      }
    | null
    | undefined,
  permission: PermissionKey,
) {
  if (isAdminUser(user)) {
    return true;
  }

  return normalizePermissions(user?.permissions)[permission];
}

export function summarizePermissions(
  role?: string,
  permissions?: Partial<UserPermissions> | null,
) {
  if (role === "admin") {
    return "كل الصلاحيات";
  }

  const normalizedPermissions = normalizePermissions(permissions);
  const labels = permissionKeys
    .filter((key) => normalizedPermissions[key])
    .map((key) => permissionLabels[key]);

  return labels.length > 0 ? labels.join(" • ") : "بدون صلاحيات إضافية";
}
