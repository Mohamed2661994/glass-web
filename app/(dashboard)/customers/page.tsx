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
import { Search, Phone, Plus, Trash2, Pencil, X, Loader2 } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";

type CustomerPhone = { id: number; phone: string };
type Customer = {
  id: number;
  name: string;
  apply_items_discount: boolean;
  phones: CustomerPhone[];
};

export default function CustomersPage() {
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

  // Delete phone confirm
  const [deletePhoneTarget, setDeletePhoneTarget] = useState<{
    customerId: number;
    phoneId: number;
    phone: string;
  } | null>(null);

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
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(c);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
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
      </div>
    </PageContainer>
  );
}
