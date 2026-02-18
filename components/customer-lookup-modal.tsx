"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  Loader2,
  Check,
} from "lucide-react";
import api from "@/services/api";

type CustomerPhone = { id: number; phone: string };
type Customer = {
  id: number;
  name: string;
  apply_items_discount: boolean;
  phones: CustomerPhone[];
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect?: (customer: {
    id: number;
    name: string;
    phone: string;
    apply_items_discount: boolean;
  }) => void;
}

export function CustomerLookupModal({ open, onOpenChange, onSelect }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Edit state
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhones, setEditPhones] = useState<CustomerPhone[]>([]);
  const [newPhone, setNewPhone] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
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
      setFocusedIndex(-1);
    } catch {
      toast.error("فشل تحميل العملاء");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setSearch("");
      setEditCustomer(null);
      fetchCustomers();
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchCustomers(val), 400);
  };

  const handleSelect = (c: Customer) => {
    onSelect?.({
      id: c.id,
      name: c.name,
      phone: c.phones[0]?.phone || "",
      apply_items_discount: c.apply_items_discount,
    });
    onOpenChange(false);
  };

  // Keyboard nav
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editCustomer) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((p) => (p < customers.length - 1 ? p + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((p) => (p > 0 ? p - 1 : customers.length - 1));
    } else if (e.key === "Enter" && focusedIndex >= 0) {
      e.preventDefault();
      handleSelect(customers[focusedIndex]);
    }
  };

  // Scroll focused into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const el = listRef.current.children[focusedIndex] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex]);

  // Edit functions
  const openEdit = (c: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditCustomer(c);
    setEditName(c.name);
    setEditPhones([...c.phones]);
    setNewPhone("");
  };

  const closeEdit = () => {
    setEditCustomer(null);
  };

  const saveCustomerName = async () => {
    if (!editCustomer || !editName.trim()) return;
    try {
      setSavingName(true);
      await api.put(`/customers/${editCustomer.id}`, {
        name: editName.trim(),
      });
      toast.success("تم تحديث الاسم");
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
      const { data } = await api.get(`/customers/${editCustomer.id}/phones`);
      setEditPhones(data);
      setNewPhone("");
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

  const deletePhone = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(
        `/customers/${deleteTarget.customerId}/phones/${deleteTarget.phoneId}`,
      );
      toast.success("تم حذف الرقم");
      const updated = editPhones.filter((p) => p.id !== deleteTarget.phoneId);
      setEditPhones(updated);
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === deleteTarget.customerId ? { ...c, phones: updated } : c,
        ),
      );
    } catch {
      toast.error("فشل حذف الرقم");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-lg max-h-[85vh] flex flex-col"
          dir="rtl"
          onKeyDown={handleKeyDown}
        >
          <DialogHeader>
            <DialogTitle>
              {editCustomer ? "تعديل بيانات العميل" : "بحث عن عميل (F2)"}
            </DialogTitle>
          </DialogHeader>

          {!editCustomer ? (
            <>
              {/* Search */}
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="ابحث بالاسم أو رقم الهاتف..."
                  className="pr-9"
                />
              </div>

              {/* Results */}
              <div
                ref={listRef}
                className="flex-1 overflow-y-auto space-y-1 min-h-0"
              >
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : customers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    لا يوجد نتائج
                  </p>
                ) : (
                  customers.map((c, idx) => (
                    <div
                      key={c.id}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                        idx === focusedIndex
                          ? "bg-blue-100 dark:bg-blue-900/40"
                          : "hover:bg-muted"
                      }`}
                      onClick={() => handleSelect(c)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{c.name}</p>
                        {c.phones.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-0.5">
                            {c.phones.map((p) => (
                              <span
                                key={p.id}
                                className="text-xs text-muted-foreground flex items-center gap-0.5"
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
                        className="h-7 w-7 shrink-0"
                        onClick={(e) => openEdit(c, e)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-green-600"
                        onClick={() => handleSelect(c)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            /* Edit View */
            <div className="space-y-5">
              <Button
                variant="ghost"
                size="sm"
                onClick={closeEdit}
                className="gap-1 text-xs"
              >
                ← رجوع للقائمة
              </Button>

              {/* Name */}
              <div>
                <Label>اسم العميل</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
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
                      editName.trim() === editCustomer.name
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
                          setDeleteTarget({
                            customerId: editCustomer.id,
                            phoneId: p.id,
                            phone: p.phone,
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
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
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف رقم الهاتف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف الرقم {deleteTarget?.phone}؟
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
    </>
  );
}
