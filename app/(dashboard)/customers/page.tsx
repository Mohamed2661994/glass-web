"use client";

import { useEffect, useRef, useState } from "react";
import api from "@/services/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Search,
  Phone,
  Plus,
  Trash2,
  Pencil,
  Eye,
  X,
  Loader2,
  FileText,
  RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { useRealtime } from "@/hooks/use-realtime";
import { Skeleton } from "@/components/ui/skeleton";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type CustomerPhone = { id: number; phone: string };
type Customer = {
  id: number;
  name: string;
  apply_items_discount: boolean;
  phones: CustomerPhone[];
};

type CustomerInvoice = {
  id: number;
  invoice_type: string;
  movement_type: string;
  is_return?: boolean;
  customer_name: string;
  total: number;
  payment_status: string;
  invoice_date: string;
  created_at: string;
};

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Edit dialog
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhones, setEditPhones] = useState<CustomerPhone[]>([]);
  const [newPhone, setNewPhone] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);

  // Delete customer confirm
  const [deleteCustomerTarget, setDeleteCustomerTarget] =
    useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState(false);

  // Delete phone confirm
  const [deletePhoneTarget, setDeletePhoneTarget] = useState<{
    customerId: number;
    phoneId: number;
    phone: string;
  } | null>(null);

  // Customer invoices dialog
  const [invoicesCustomer, setInvoicesCustomer] = useState<Customer | null>(
    null,
  );
  const [customerInvoices, setCustomerInvoices] = useState<CustomerInvoice[]>(
    [],
  );
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [renameTarget, setRenameTarget] = useState("");
  const [renaming, setRenaming] = useState(false);

  const fetchCustomers = async (q?: string) => {
    try {
      setLoading(true);
      const params: any = {};
      if (q && q.trim().length >= 2) params.search = q.trim();
      const { data } = await api.get("/customers", { params });
      setCustomers(data);
    } catch {
      toast.error("فشل تحميل العملاء");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  useRealtime("data:customers", fetchCustomers);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => fetchCustomers(val), 400);
  };

  const openEdit = (c: Customer) => {
    setEditCustomer(c);
    setEditName(c.name);
    setEditPhones([...c.phones]);
    setNewPhone("");
  };

  const closeEdit = () => {
    setEditCustomer(null);
    setEditName("");
    setEditPhones([]);
    setNewPhone("");
  };

  const saveCustomerName = async () => {
    if (!editCustomer || !editName.trim()) return;
    try {
      setSavingName(true);
      await api.put(`/customers/${editCustomer.id}`, {
        name: editName.trim(),
      });
      toast.success("تم تحديث الاسم");
      // Update locally
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === editCustomer.id ? { ...c, name: editName.trim() } : c,
        ),
      );
      setEditCustomer((prev) =>
        prev ? { ...prev, name: editName.trim() } : null,
      );
    } catch {
      toast.error("فشل تحديث الاسم");
    } finally {
      setSavingName(false);
    }
  };

  const addPhone = async () => {
    if (!editCustomer || !newPhone.trim()) return;
    try {
      setSavingPhone(true);
      await api.post(`/customers/${editCustomer.id}/phones`, {
        phone: newPhone.trim(),
      });
      toast.success("تم إضافة الرقم");
      // Refresh phones
      const { data } = await api.get(`/customers/${editCustomer.id}/phones`);
      setEditPhones(data);
      setNewPhone("");
      // Update main list
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === editCustomer.id ? { ...c, phones: data } : c,
        ),
      );
    } catch {
      toast.error("فشل إضافة الرقم - ربما مسجل بالفعل");
    } finally {
      setSavingPhone(false);
    }
  };

  const confirmDeletePhone = (
    customerId: number,
    phoneId: number,
    phone: string,
  ) => {
    setDeletePhoneTarget({ customerId, phoneId, phone });
  };

  const deleteCustomer = async () => {
    if (!deleteCustomerTarget) return;
    try {
      setDeletingCustomer(true);
      await api.delete(`/customers/${deleteCustomerTarget.id}`);
      toast.success(`تم حذف العميل "${deleteCustomerTarget.name}"`);
      setCustomers((prev) =>
        prev.filter((c) => c.id !== deleteCustomerTarget.id),
      );
      // If we were editing this customer, close the dialog
      if (editCustomer?.id === deleteCustomerTarget.id) closeEdit();
    } catch (err: any) {
      const msg = err?.response?.data?.error || "فشل حذف العميل";
      toast.error(msg);
    } finally {
      setDeletingCustomer(false);
      setDeleteCustomerTarget(null);
    }
  };

  const deletePhone = async () => {
    if (!deletePhoneTarget) return;
    try {
      await api.delete(
        `/customers/${deletePhoneTarget.customerId}/phones/${deletePhoneTarget.phoneId}`,
      );
      toast.success("تم حذف الرقم");
      // Update local state
      const updated = editPhones.filter(
        (p) => p.id !== deletePhoneTarget.phoneId,
      );
      setEditPhones(updated);
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === deletePhoneTarget.customerId ? { ...c, phones: updated } : c,
        ),
      );
    } catch {
      toast.error("فشل حذف الرقم");
    } finally {
      setDeletePhoneTarget(null);
    }
  };

  const openCustomerInvoices = async (c: Customer) => {
    setInvoicesCustomer(c);
    setRenameTarget(c.name);
    setCustomerInvoices([]);
    setLoadingInvoices(true);
    try {
      const { data } = await api.get("/invoices", {
        params: { customer_id: c.id, limit: 200 },
      });
      setCustomerInvoices(Array.isArray(data) ? data : data.invoices || []);
    } catch {
      toast.error("فشل تحميل الفواتير");
    } finally {
      setLoadingInvoices(false);
    }
  };

  const renameInInvoices = async () => {
    if (
      !invoicesCustomer ||
      !renameTarget.trim() ||
      renameTarget.trim() === invoicesCustomer.name
    )
      return;
    try {
      setRenaming(true);
      const { data } = await api.put("/invoices/rename-customer", {
        old_name: invoicesCustomer.name,
        new_name: renameTarget.trim(),
      });
      toast.success(data.message || "تم تحديث الاسم");
      const newName = renameTarget.trim();
      setCustomerInvoices((prev) =>
        prev.map((inv) =>
          inv.customer_name === invoicesCustomer.name
            ? { ...inv, customer_name: newName }
            : inv,
        ),
      );
      setInvoicesCustomer((prev) => (prev ? { ...prev, name: newName } : null));
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === invoicesCustomer.id ? { ...c, name: newName } : c,
        ),
      );
    } catch {
      toast.error("فشل تحديث الاسم");
    } finally {
      setRenaming(false);
    }
  };

  return (
    <PageContainer>
      <div className="max-w-3xl mx-auto" dir="rtl">
        <h1 className="text-xl font-bold text-center mb-1">إدارة العملاء</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          عرض وتعديل بيانات العملاء وأرقام هواتفهم
        </p>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="ابحث بالاسم أو رقم الهاتف..."
            className="pr-9"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-24 rounded-full" />
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : customers.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            لا يوجد عملاء
          </p>
        ) : (
          <div className="space-y-2">
            {customers.map((c) => (
              <Card
                key={c.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => openEdit(c)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{c.name}</p>
                    {c.phones.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {c.phones.map((p) => (
                          <span
                            key={p.id}
                            className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex items-center gap-1"
                          >
                            <Phone className="h-3 w-3" />
                            {p.phone}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        openCustomerInvoices(c);
                      }}
                      title="عرض فواتير العميل"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteCustomerTarget(c);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(c);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editCustomer} onOpenChange={(o) => !o && closeEdit()}>
          <DialogContent className="max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle>تعديل بيانات العميل</DialogTitle>
            </DialogHeader>

            <div className="space-y-5 mt-2">
              {/* Name */}
              <div>
                <Label>اسم العميل</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="اسم العميل"
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveCustomerName();
                    }}
                  />
                  <Button
                    size="sm"
                    disabled={
                      savingName ||
                      !editName.trim() ||
                      editName.trim() === editCustomer?.name
                    }
                    onClick={saveCustomerName}
                  >
                    {savingName ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "حفظ"
                    )}
                  </Button>
                </div>
              </div>

              {/* Phones */}
              <div>
                <Label>أرقام الهاتف</Label>
                <div className="space-y-2 mt-2">
                  {editPhones.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      لا توجد أرقام مسجلة
                    </p>
                  )}
                  {editPhones.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2"
                    >
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-sm font-medium">
                        {p.phone}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() =>
                          confirmDeletePhone(editCustomer!.id, p.id, p.phone)
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  {/* Add new phone */}
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={newPhone}
                      inputMode="tel"
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="رقم هاتف جديد..."
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addPhone();
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={savingPhone || !newPhone.trim()}
                      onClick={addPhone}
                      className="gap-1"
                    >
                      {savingPhone ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" />
                          إضافة
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={closeEdit}>
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Customer Confirm */}
        <AlertDialog
          open={!!deleteCustomerTarget}
          onOpenChange={(o) => !o && setDeleteCustomerTarget(null)}
        >
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>حذف العميل</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف العميل &quot;{deleteCustomerTarget?.name}
                &quot;؟
                <br />
                سيتم حذف جميع أرقام الهاتف المسجلة له.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingCustomer}>
                إلغاء
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={deleteCustomer}
                disabled={deletingCustomer}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deletingCustomer ? (
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                ) : null}
                حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Phone Confirm */}
        <AlertDialog
          open={!!deletePhoneTarget}
          onOpenChange={(o) => !o && setDeletePhoneTarget(null)}
        >
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>حذف رقم الهاتف</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف الرقم {deletePhoneTarget?.phone}؟
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={deletePhone}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Customer Invoices Dialog */}
        <Dialog
          open={!!invoicesCustomer}
          onOpenChange={(o) => !o && setInvoicesCustomer(null)}
        >
          <DialogContent
            className="max-w-2xl max-h-[90vh] flex flex-col"
            dir="rtl"
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                فواتير العميل: {invoicesCustomer?.name}
              </DialogTitle>
            </DialogHeader>

            {/* Rename in invoices */}
            <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
              <p className="text-sm font-medium">
                تغيير اسم العميل في الفواتير
              </p>
              <div className="flex gap-2">
                <Input
                  value={renameTarget}
                  onChange={(e) => setRenameTarget(e.target.value)}
                  placeholder="الاسم الجديد..."
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") renameInInvoices();
                  }}
                />
                <Button
                  size="sm"
                  disabled={
                    renaming ||
                    !renameTarget.trim() ||
                    renameTarget.trim() === invoicesCustomer?.name
                  }
                  onClick={renameInInvoices}
                  className="gap-1"
                >
                  {renaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="h-3.5 w-3.5" />
                      تغيير في كل الفواتير
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                سيتم تغيير الاسم في كل الفواتير المسجلة بالاسم الحالي بالضبط
              </p>
            </div>

            {/* Invoices list */}
            <div className="flex-1 overflow-auto min-h-0">
              {loadingInvoices ? (
                <div className="space-y-2 py-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : customerInvoices.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  لا توجد فواتير بهذا الاسم
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">#</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">النوع</TableHead>
                      <TableHead className="text-right">الحركة</TableHead>
                      <TableHead className="text-right">الإجمالي</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">فتح</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerInvoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.id}</TableCell>
                        <TableCell>
                          {inv.invoice_date
                            ? new Date(inv.invoice_date).toLocaleDateString(
                                "ar-EG",
                              )
                            : new Date(inv.created_at).toLocaleDateString(
                                "ar-EG",
                              )}
                        </TableCell>
                        <TableCell>
                          {inv.invoice_type === "retail" ? "تجزئة" : "جملة"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              inv.is_return
                                ? "destructive"
                                : inv.movement_type === "sale"
                                  ? "default"
                                  : "secondary"
                            }
                          >
                            {inv.is_return
                              ? "مرتجع"
                              : inv.movement_type === "sale"
                                ? "بيع"
                                : "شراء"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {Number(inv.total).toLocaleString("ar-EG")} ج
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              inv.payment_status === "paid"
                                ? "default"
                                : inv.payment_status === "partial"
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {inv.payment_status === "paid"
                              ? "مدفوع"
                              : inv.payment_status === "partial"
                                ? "جزئي"
                                : "غير مدفوع"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => {
                              setInvoicesCustomer(null);
                              router.push(`/invoices/${inv.id}`);
                            }}
                            title="فتح الفاتورة"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              إجمالي {customerInvoices.length} فاتورة
            </p>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setInvoicesCustomer(null)}
              >
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainer>
  );
}
