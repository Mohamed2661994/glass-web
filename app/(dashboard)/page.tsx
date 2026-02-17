"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/auth-context";
import api from "@/services/api";
import {
  FileText,
  Truck,
  RefreshCw,
  Banknote,
  AlertTriangle,
  ShoppingCart,
  Settings2,
  GripVertical,
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  ArrowLeftRight,
  Package,
  Users,
  BarChart3,
  Bell,
  Link2,
  CircleDot,
  Maximize2,
  Minimize2,
  Pencil,
  Trash2,
  X,
  Factory,
  ClipboardList,
  List,
  BookOpen,
  RotateCcw,
  Download,
  LayoutDashboard,
  Home,
  Star,
  Heart,
  Search,
  Eye,
  Clock,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Send,
  Upload,
  Printer,
  Save,
  Copy,
  Check,
  CheckCircle,
  XCircle,
  Info,
  HelpCircle,
  Lock,
  Unlock,
  Shield,
  Zap,
  Flame,
  Sun,
  Moon,
  Cloud,
  Droplets,
  Gift,
  Tag,
  Tags,
  Bookmark,
  Flag,
  Award,
  Target,
  Percent,
  DollarSign,
  CreditCard,
  Receipt,
  HandCoins,
  PiggyBank,
  Landmark,
  Building2,
  Store,
  Warehouse,
  Box,
  Boxes,
  PackageCheck,
  PackageX,
  Scan,
  QrCode,
  Barcode,
  Globe,
  Wifi,
  Database,
  HardDrive,
  Server,
  Monitor,
  Smartphone,
  Layers,
  Grid3X3,
  LayoutGrid,
  PanelLeft,
  SlidersHorizontal,
  Filter,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  ChevronsUp,
  ChevronsDown,
  Repeat,
  Shuffle,
  CirclePlus,
  CircleMinus,
  UserPlus,
  UserCheck,
  UsersRound,
  Contact,
  BadgeCheck,
  BadgeDollarSign,
  Calculator,
  FileSpreadsheet,
  FolderOpen,
  Archive,
  Inbox,
  MessageSquare,
  MessagesSquare,
  Megaphone,
  Activity,
  PieChart,
  LineChart,
  Gauge,
  Timer,
  Hourglass,
  CalendarDays,
  CalendarCheck,
  Wrench,
  Hammer,
  Cog,
  Power,
  RefreshCcw,
  ExternalLink,
  Share2,
  Paperclip,
  Scissors,
  Lightbulb,
  Sparkles,
  Crown,
  Gem,
  Rocket,
  Plane,
  Car,
  Bike,
  Ship,
  TreePine,
  Leaf,
  Apple,
  Coffee,
  UtensilsCrossed,
  Stethoscope,
  Pill,
  Glasses,
  Camera,
  Image,
  Music,
  Video,
  Mic,
  Headphones,
  Gamepad2,
  Palette,
  Brush,
  PenTool,
  Type,
  Binary,
  Code,
  Terminal as TerminalIcon,
  FileCode,
  Bug,
  TestTube,
  Atom,
  Dna,
  Fingerprint,
  ScanFace,
  Brain,
  GraduationCap,
  School,
  Library,
  Newspaper,
  Radio,
  Tv,
  Wifi as WifiIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/* ---------- types ---------- */
interface Invoice {
  id: number;
  invoice_type: "retail" | "wholesale";
  movement_type: "sale" | "purchase";
  customer_name: string;
  total: number;
  payment_status: "paid" | "partial" | "unpaid";
  created_at: string;
}

interface Transfer {
  id: number;
  items_count: number;
  total_from_quantity: number;
  status: string;
  created_at: string;
}

interface DashboardStats {
  today_sales: number;
  today_invoices_count: number;
  today_cash: number;
  low_stock_count: number;
}

interface CashInItem {
  id: number;
  amount: number;
  paid_amount: number;
}

interface CashOutItem {
  id: number;
  amount: number;
}

interface Notification {
  id: number;
  message: string;
  is_read: boolean;
  created_at: string;
}

/* ---------- widget config ---------- */
type WidgetId =
  | "kpi_cards"
  | "recent_invoices"
  | "recent_transfers"
  | "cash_summary"
  | "quick_links"
  | "notifications";

type WidgetSize = "full" | "half";

interface WidgetConfig {
  id: WidgetId;
  label: string;
  visible: boolean;
  order: number;
  size: WidgetSize;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  {
    id: "kpi_cards",
    label: "بطاقات الإحصائيات",
    visible: true,
    order: 0,
    size: "full",
  },
  {
    id: "cash_summary",
    label: "ملخص الخزنة",
    visible: true,
    order: 1,
    size: "half",
  },
  {
    id: "quick_links",
    label: "روابط سريعة",
    visible: true,
    order: 2,
    size: "half",
  },
  {
    id: "recent_invoices",
    label: "آخر الفواتير",
    visible: true,
    order: 3,
    size: "full",
  },
  {
    id: "recent_transfers",
    label: "آخر التحويلات",
    visible: true,
    order: 4,
    size: "full",
  },
  {
    id: "notifications",
    label: "آخر الإشعارات",
    visible: true,
    order: 5,
    size: "half",
  },
];

/* ---------- quick links config ---------- */
interface QuickLink {
  id: string;
  label: string;
  href: string;
  icon: string;
  color: string;
}

const ICON_MAP: Record<string, any> = {
  Plus,
  FileText,
  Package,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  Users,
  BarChart3,
  Wallet,
  ShoppingCart,
  Truck,
  Factory,
  ClipboardList,
  List,
  BookOpen,
  Bell,
  AlertTriangle,
  Banknote,
  RotateCcw,
  Download,
  LayoutDashboard,
  Home,
  Star,
  Heart,
  Search,
  Eye,
  Clock,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Send,
  Upload,
  Printer,
  Save,
  Copy,
  Check,
  CheckCircle,
  XCircle,
  Info,
  HelpCircle,
  Lock,
  Unlock,
  Shield,
  Zap,
  Flame,
  Sun,
  Moon,
  Cloud,
  Droplets,
  Gift,
  Tag,
  Tags,
  Bookmark,
  Flag,
  Award,
  Target,
  Percent,
  DollarSign,
  CreditCard,
  Receipt,
  HandCoins,
  PiggyBank,
  Landmark,
  Building2,
  Store,
  Warehouse,
  Box,
  Boxes,
  PackageCheck,
  PackageX,
  Scan,
  QrCode,
  Barcode,
  Globe,
  Wifi,
  Database,
  HardDrive,
  Server,
  Monitor,
  Smartphone,
  Layers,
  Grid3X3,
  LayoutGrid,
  PanelLeft,
  SlidersHorizontal,
  Filter,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  ChevronsUp,
  ChevronsDown,
  Repeat,
  Shuffle,
  CirclePlus,
  CircleMinus,
  UserPlus,
  UserCheck,
  UsersRound,
  Contact,
  BadgeCheck,
  BadgeDollarSign,
  Calculator,
  FileSpreadsheet,
  FolderOpen,
  Archive,
  Inbox,
  MessageSquare,
  MessagesSquare,
  Megaphone,
  Activity,
  PieChart,
  LineChart,
  Gauge,
  Timer,
  Hourglass,
  CalendarDays,
  CalendarCheck,
  Wrench,
  Hammer,
  Cog,
  Power,
  RefreshCcw,
  ExternalLink,
  Share2,
  Paperclip,
  Scissors,
  Lightbulb,
  Sparkles,
  Crown,
  Gem,
  Rocket,
  Plane,
  Car,
  Bike,
  Ship,
  TreePine,
  Leaf,
  Apple,
  Coffee,
  UtensilsCrossed,
  Stethoscope,
  Pill,
  Glasses,
  Camera,
  Image,
  Music,
  Video,
  Mic,
  Headphones,
  Gamepad2,
  Palette,
  Brush,
  PenTool,
  Type,
  Binary,
  Code,
  TerminalIcon,
  FileCode,
  Bug,
  TestTube,
  Atom,
  Dna,
  Fingerprint,
  ScanFace,
  Brain,
  GraduationCap,
  School,
  Library,
  Newspaper,
  Radio,
  Tv,
};

const ICON_OPTIONS = Object.keys(ICON_MAP);

const COLOR_OPTIONS = [
  { value: "bg-blue-500/10 text-blue-600 dark:text-blue-400", label: "أزرق" },
  {
    value: "bg-green-500/10 text-green-600 dark:text-green-400",
    label: "أخضر",
  },
  {
    value: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    label: "بنفسجي",
  },
  {
    value: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    label: "برتقالي",
  },
  {
    value: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    label: "زمردي",
  },
  { value: "bg-sky-500/10 text-sky-600 dark:text-sky-400", label: "سماوي" },
  {
    value: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    label: "عنبري",
  },
  { value: "bg-rose-500/10 text-rose-600 dark:text-rose-400", label: "وردي" },
  { value: "bg-red-500/10 text-red-600 dark:text-red-400", label: "أحمر" },
  { value: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400", label: "سيان" },
  {
    value: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    label: "نيلي",
  },
  {
    value: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    label: "بنفسجي غامق",
  },
  {
    value: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
    label: "فوشيا",
  },
  { value: "bg-pink-500/10 text-pink-600 dark:text-pink-400", label: "زهري" },
  { value: "bg-teal-500/10 text-teal-600 dark:text-teal-400", label: "تيل" },
  { value: "bg-lime-500/10 text-lime-600 dark:text-lime-400", label: "ليموني" },
  {
    value: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    label: "أصفر",
  },
  {
    value: "bg-stone-500/10 text-stone-600 dark:text-stone-400",
    label: "حجري",
  },
  {
    value: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
    label: "رمادي",
  },
  { value: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400", label: "زنك" },
];

const ALL_PAGES: { label: string; href: string }[] = [
  { label: "فاتورة قطاعي", href: "/invoices/create/retail" },
  { label: "فاتورة جملة", href: "/invoices/create/wholesale" },
  { label: "الفواتير", href: "/invoices" },
  { label: "الأصناف", href: "/products" },
  { label: "المصانع", href: "/manufacturers" },
  { label: "تحويل مخزون", href: "/stock-transfer" },
  { label: "وارد الخزنة", href: "/cash/in" },
  { label: "عرض الوارد", href: "/cash/in/list" },
  { label: "صرف نقدي", href: "/cash/out" },
  { label: "عرض المنصرف", href: "/cash/out/list" },
  { label: "اليومية", href: "/cash/summary" },
  { label: "أرصدة العملاء", href: "/reports/customer-balances" },
  { label: "جرد المخزون", href: "/reports/inventory-summary" },
  { label: "قيمة المخزون", href: "/reports/inventory-value" },
  { label: "نقص المخزون", href: "/reports/low-stock" },
  { label: "حركة صنف", href: "/reports/product-movement" },
  { label: "استبدال", href: "/replace" },
  { label: "رصيد افتتاحي", href: "/opening-stock" },
  { label: "الإعدادات", href: "/settings" },
  { label: "المستخدمين", href: "/users" },
];

const DEFAULT_QUICK_LINKS: QuickLink[] = [
  {
    id: "1",
    label: "فاتورة جديدة",
    href: "/invoices/create/retail",
    icon: "Plus",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  {
    id: "2",
    label: "الفواتير",
    href: "/invoices",
    icon: "FileText",
    color: "bg-green-500/10 text-green-600 dark:text-green-400",
  },
  {
    id: "3",
    label: "الأصناف",
    href: "/products",
    icon: "Package",
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
  {
    id: "4",
    label: "تحويل مخزون",
    href: "/stock-transfer",
    icon: "ArrowLeftRight",
    color: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  {
    id: "5",
    label: "وارد الخزنة",
    href: "/cash/in",
    icon: "TrendingUp",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "6",
    label: "أرصدة العملاء",
    href: "/reports/customer-balances",
    icon: "Users",
    color: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  {
    id: "7",
    label: "جرد المخزون",
    href: "/reports/inventory-summary",
    icon: "BarChart3",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    id: "8",
    label: "ملخص الخزنة",
    href: "/cash/summary",
    icon: "Wallet",
    color: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
];

function getQuickLinks(userId: number): QuickLink[] {
  try {
    const raw = localStorage.getItem(`quick_links_${userId}`);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return DEFAULT_QUICK_LINKS;
}

function saveQuickLinks(userId: number, links: QuickLink[]) {
  localStorage.setItem(`quick_links_${userId}`, JSON.stringify(links));
}

function getDashboardConfig(userId: number): WidgetConfig[] {
  try {
    const raw = localStorage.getItem(`dashboard_config_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as WidgetConfig[];
      const map = new Map(parsed.map((w) => [w.id, w]));
      return DEFAULT_WIDGETS.map((dw) => {
        const saved = map.get(dw.id);
        return saved ? { ...dw, ...saved, label: dw.label } : dw;
      }).sort((a, b) => a.order - b.order);
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_WIDGETS;
}

function saveDashboardConfig(userId: number, config: WidgetConfig[]) {
  localStorage.setItem(`dashboard_config_${userId}`, JSON.stringify(config));
}

/* ---------- helpers ---------- */
const paymentBadge = (s: string) => {
  switch (s) {
    case "paid":
      return <Badge className="bg-green-600">مدفوعة</Badge>;
    case "partial":
      return <Badge className="bg-yellow-500">جزئي</Badge>;
    default:
      return <Badge variant="destructive">غير مدفوعة</Badge>;
  }
};

const movementLabel = (m: string) =>
  m === "sale" ? "بيع" : m === "purchase" ? "شراء" : m;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ar-EG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/* ========================================= */
export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const branchId = user?.branch_id;
  const invoiceType = branchId === 1 ? "retail" : "wholesale";

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingInv, setLoadingInv] = useState(true);
  const [loadingTr, setLoadingTr] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  /* cash summary */
  const [cashInTotal, setCashInTotal] = useState(0);
  const [cashOutTotal, setCashOutTotal] = useState(0);
  const [loadingCash, setLoadingCash] = useState(true);

  /* notifications */
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);

  /* ---------- widget customization ---------- */
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  /* ---------- quick links ---------- */
  const [quickLinks, setQuickLinks] =
    useState<QuickLink[]>(DEFAULT_QUICK_LINKS);
  const [linksEditorOpen, setLinksEditorOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<QuickLink | null>(null);
  const [linkForm, setLinkForm] = useState({
    label: "",
    href: "",
    icon: "Plus",
    color: COLOR_OPTIONS[0].value,
  });

  useEffect(() => {
    if (user?.id) {
      setWidgets(getDashboardConfig(user.id));
      setQuickLinks(getQuickLinks(user.id));
    }
  }, [user?.id]);

  const isVisible = useCallback(
    (id: WidgetId) => widgets.find((w) => w.id === id)?.visible ?? true,
    [widgets],
  );

  const toggleWidget = useCallback(
    (id: WidgetId) => {
      setWidgets((prev) => {
        const next = prev.map((w) =>
          w.id === id ? { ...w, visible: !w.visible } : w,
        );
        if (user?.id) saveDashboardConfig(user.id, next);
        return next;
      });
    },
    [user?.id],
  );

  const toggleSize = useCallback(
    (id: WidgetId) => {
      setWidgets((prev) => {
        const next = prev.map((w) =>
          w.id === id
            ? {
                ...w,
                size: (w.size === "full" ? "half" : "full") as WidgetSize,
              }
            : w,
        );
        if (user?.id) saveDashboardConfig(user.id, next);
        return next;
      });
    },
    [user?.id],
  );

  const addQuickLink = () => {
    if (!linkForm.label || !linkForm.href) return;
    const newLink: QuickLink = {
      id: Date.now().toString(),
      ...linkForm,
    };
    setQuickLinks((prev) => {
      const next = [...prev, newLink];
      if (user?.id) saveQuickLinks(user.id, next);
      return next;
    });
    setLinkForm({
      label: "",
      href: "",
      icon: "Plus",
      color: COLOR_OPTIONS[0].value,
    });
  };

  const updateQuickLink = () => {
    if (!editingLink || !linkForm.label || !linkForm.href) return;
    setQuickLinks((prev) => {
      const next = prev.map((l) =>
        l.id === editingLink.id ? { ...l, ...linkForm } : l,
      );
      if (user?.id) saveQuickLinks(user.id, next);
      return next;
    });
    setEditingLink(null);
    setLinkForm({
      label: "",
      href: "",
      icon: "Plus",
      color: COLOR_OPTIONS[0].value,
    });
  };

  const deleteQuickLink = (id: string) => {
    setQuickLinks((prev) => {
      const next = prev.filter((l) => l.id !== id);
      if (user?.id) saveQuickLinks(user.id, next);
      return next;
    });
  };

  const resetQuickLinks = () => {
    setQuickLinks(DEFAULT_QUICK_LINKS);
    if (user?.id) saveQuickLinks(user.id, DEFAULT_QUICK_LINKS);
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setWidgets((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      const reordered = next.map((w, i) => ({ ...w, order: i }));
      if (user?.id) saveDashboardConfig(user.id, reordered);
      return reordered;
    });
    setDragIdx(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  const sortedWidgets = useMemo(
    () => [...widgets].sort((a, b) => a.order - b.order),
    [widgets],
  );

  /* re-fetch when page becomes visible (user navigates back) */
  useEffect(() => {
    const onFocus = () => setRefreshKey((k) => k + 1);
    const onVisibility = () => {
      if (document.visibilityState === "visible") onFocus();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  /* fetch invoices */
  useEffect(() => {
    if (!branchId) return;
    setLoadingInv(true);
    (async () => {
      try {
        const { data } = await api.get("/invoices", {
          params: { limit: 10, invoice_type: invoiceType, _t: Date.now() },
        });
        setInvoices(Array.isArray(data) ? data : (data.data ?? []));
      } catch {
        /* silent */
      } finally {
        setLoadingInv(false);
      }
    })();
  }, [branchId, invoiceType, refreshKey]);

  /* fetch dashboard stats */
  useEffect(() => {
    if (!branchId) return;
    setLoadingStats(true);
    (async () => {
      try {
        const { data } = await api.get("/dashboard/stats", {
          params: { invoice_type: invoiceType, _t: Date.now() },
        });
        setStats(data);
      } catch {
        /* silent */
      } finally {
        setLoadingStats(false);
      }
    })();
  }, [branchId, invoiceType, refreshKey]);

  /* fetch transfers (branch 2 only) */
  useEffect(() => {
    if (branchId !== 2) {
      setLoadingTr(false);
      return;
    }
    setLoadingTr(true);
    (async () => {
      try {
        const { data } = await api.get("/stock-transfers", {
          params: { limit: 10, _t: Date.now() },
        });
        setTransfers(data?.data ?? []);
      } catch {
        /* silent */
      } finally {
        setLoadingTr(false);
      }
    })();
  }, [branchId, refreshKey]);

  /* fetch cash summary */
  useEffect(() => {
    if (!branchId) return;
    setLoadingCash(true);
    (async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const [inRes, outRes] = await Promise.all([
          api.get("/cash-in", { params: { branch_id: branchId } }),
          api.get("/cash/out", {
            params: { branch_id: branchId, from_date: today, to_date: today },
          }),
        ]);
        const inItems: CashInItem[] = inRes.data?.data ?? [];
        const outItems: CashOutItem[] = outRes.data?.data ?? [];
        setCashInTotal(
          inItems.reduce(
            (s, i) => s + Number(i.paid_amount || i.amount || 0),
            0,
          ),
        );
        setCashOutTotal(
          outItems.reduce((s, i) => s + Number(i.amount || 0), 0),
        );
      } catch {
        /* silent */
      } finally {
        setLoadingCash(false);
      }
    })();
  }, [branchId, refreshKey]);

  /* fetch notifications */
  useEffect(() => {
    setLoadingNotifs(true);
    (async () => {
      try {
        const { data } = await api.get("/notifications");
        setNotifications(Array.isArray(data) ? data.slice(0, 8) : []);
      } catch {
        /* silent */
      } finally {
        setLoadingNotifs(false);
      }
    })();
  }, [refreshKey]);

  /* ---------- skeleton rows ---------- */
  const skelRows = (cols: number) =>
    Array.from({ length: 5 }).map((_, i) => (
      <TableRow key={i}>
        {Array.from({ length: cols }).map((_, j) => (
          <TableCell key={j}>
            <Skeleton className="h-4 w-full" />
          </TableCell>
        ))}
      </TableRow>
    ));

  /* ---------- widget renderers ---------- */
  const renderWidget = (id: WidgetId) => {
    switch (id) {
      case "kpi_cards":
        return (
          <div key={id} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2.5">
                  <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">مبيعات اليوم</p>
                  {loadingStats ? (
                    <Skeleton className="h-6 w-20 mt-1" />
                  ) : (
                    <p className="text-lg font-bold">
                      {Math.round(stats?.today_sales ?? 0).toLocaleString()} ج
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-2.5">
                  <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">فواتير اليوم</p>
                  {loadingStats ? (
                    <Skeleton className="h-6 w-12 mt-1" />
                  ) : (
                    <p className="text-lg font-bold">
                      {stats?.today_invoices_count ?? 0}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/30 p-2.5">
                  <Banknote className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">نقدية اليوم</p>
                  {loadingStats ? (
                    <Skeleton className="h-6 w-20 mt-1" />
                  ) : (
                    <p className="text-lg font-bold">
                      {Math.round(stats?.today_cash ?? 0).toLocaleString()} ج
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-orange-100 dark:bg-orange-900/30 p-2.5">
                  <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">أصناف منخفضة</p>
                  {loadingStats ? (
                    <Skeleton className="h-6 w-12 mt-1" />
                  ) : (
                    <p className="text-lg font-bold">
                      {stats?.low_stock_count ?? 0}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "recent_invoices":
        return (
          <Card key={id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" />
                آخر الفواتير
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setRefreshKey((k) => k + 1)}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Badge variant="outline">{invoices.length} فاتورة</Badge>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">#</TableHead>
                    <TableHead className="text-right">العميل</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">الإجمالي</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingInv ? (
                    skelRows(6)
                  ) : invoices.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-muted-foreground"
                      >
                        لا توجد فواتير
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoices.map((inv) => (
                      <TableRow
                        key={inv.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/invoices/${inv.id}`)}
                      >
                        <TableCell className="font-medium">{inv.id}</TableCell>
                        <TableCell>{inv.customer_name || "—"}</TableCell>
                        <TableCell>
                          {movementLabel(inv.movement_type)}
                        </TableCell>
                        <TableCell>
                          {Math.round(inv.total).toLocaleString()} ج
                        </TableCell>
                        <TableCell>
                          {paymentBadge(inv.payment_status)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {formatDate(inv.created_at)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      case "recent_transfers":
        if (branchId !== 2) return null;
        return (
          <Card key={id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Truck className="h-5 w-5" />
                آخر التحويلات
              </CardTitle>
              <Badge variant="outline">{transfers.length} تحويل</Badge>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">رقم التحويل</TableHead>
                    <TableHead className="text-right">عدد الأصناف</TableHead>
                    <TableHead className="text-right">إجمالي الكمية</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingTr ? (
                    skelRows(5)
                  ) : transfers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-muted-foreground"
                      >
                        لا توجد تحويلات
                      </TableCell>
                    </TableRow>
                  ) : (
                    transfers.map((tr) => (
                      <TableRow
                        key={tr.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/transfers/${tr.id}`)}
                      >
                        <TableCell className="font-medium">{tr.id}</TableCell>
                        <TableCell>{tr.items_count}</TableCell>
                        <TableCell>{tr.total_from_quantity}</TableCell>
                        <TableCell>
                          {tr.status === "cancelled" ? (
                            <Badge variant="destructive">ملغي</Badge>
                          ) : (
                            <Badge className="bg-green-600">تم</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {formatDate(tr.created_at)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      /* ===== Cash Summary Widget ===== */
      case "cash_summary": {
        const netCash = cashInTotal - cashOutTotal;
        return (
          <Card key={id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wallet className="h-5 w-5" />
                ملخص الخزنة (اليوم)
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setRefreshKey((k) => k + 1)}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {loadingCash ? (
                <div className="grid grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {/* وارد */}
                  <div className="rounded-xl bg-green-500/10 dark:bg-green-500/15 p-4 text-center">
                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto mb-1" />
                    <p className="text-[11px] text-muted-foreground mb-1">
                      الوارد
                    </p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                      {Math.round(cashInTotal).toLocaleString()}
                    </p>
                  </div>
                  {/* منصرف */}
                  <div className="rounded-xl bg-red-500/10 dark:bg-red-500/15 p-4 text-center">
                    <TrendingDown className="h-5 w-5 text-red-500 dark:text-red-400 mx-auto mb-1" />
                    <p className="text-[11px] text-muted-foreground mb-1">
                      المنصرف
                    </p>
                    <p className="text-lg font-bold text-red-500 dark:text-red-400">
                      {Math.round(cashOutTotal).toLocaleString()}
                    </p>
                  </div>
                  {/* صافي */}
                  <div
                    className={`rounded-xl p-4 text-center ${
                      netCash >= 0
                        ? "bg-blue-500/10 dark:bg-blue-500/15"
                        : "bg-orange-500/10 dark:bg-orange-500/15"
                    }`}
                  >
                    <Banknote
                      className={`h-5 w-5 mx-auto mb-1 ${
                        netCash >= 0
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-orange-600 dark:text-orange-400"
                      }`}
                    />
                    <p className="text-[11px] text-muted-foreground mb-1">
                      الصافي
                    </p>
                    <p
                      className={`text-lg font-bold ${
                        netCash >= 0
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-orange-600 dark:text-orange-400"
                      }`}
                    >
                      {Math.round(netCash).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      }

      /* ===== Quick Links Widget ===== */
      case "quick_links": {
        return (
          <Card key={id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Link2 className="h-5 w-5" />
                روابط سريعة
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => {
                  setEditingLink(null);
                  setLinkForm({
                    label: "",
                    href: "",
                    icon: "Plus",
                    color: COLOR_OPTIONS[0].value,
                  });
                  setLinksEditorOpen(true);
                }}
              >
                <Pencil className="h-3 w-3" />
                تعديل
              </Button>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {quickLinks.map((link) => {
                  const IconComp = ICON_MAP[link.icon] || Plus;
                  return (
                    <button
                      key={link.id}
                      onClick={() => router.push(link.href)}
                      className={`flex flex-col items-center gap-2 rounded-xl p-3 transition-all hover:scale-105 hover:shadow-md ${link.color}`}
                    >
                      <IconComp className="h-5 w-5" />
                      <span className="text-xs font-medium">{link.label}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      }

      /* ===== Notifications Widget ===== */
      case "notifications":
        return (
          <Card key={id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-5 w-5" />
                آخر الإشعارات
              </CardTitle>
              <Badge variant="outline">
                {notifications.filter((n) => !n.is_read).length} جديد
              </Badge>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {loadingNotifs ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-lg" />
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <p className="text-center py-6 text-muted-foreground text-sm">
                  لا توجد إشعارات
                </p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`flex items-start gap-3 rounded-lg p-2.5 transition-colors ${
                        notif.is_read
                          ? "bg-muted/30"
                          : "bg-blue-500/5 border border-blue-500/20"
                      }`}
                    >
                      <CircleDot
                        className={`h-3 w-3 mt-1.5 shrink-0 ${
                          notif.is_read
                            ? "text-muted-foreground"
                            : "text-blue-500"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-relaxed">
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDate(notif.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      {/* ====== Header with settings ====== */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">لوحة التحكم</h1>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings2 className="h-4 w-4" />
          تخصيص
        </Button>
      </div>

      {/* ====== Render widgets in grid layout ====== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sortedWidgets.map((w) => {
          if (!w.visible) return null;
          const content = renderWidget(w.id);
          if (!content) return null;
          return (
            <div
              key={w.id}
              className={w.size === "full" ? "md:col-span-2" : "md:col-span-1"}
            >
              {content}
            </div>
          );
        })}
      </div>

      {/* ====== Settings Dialog ====== */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              تخصيص لوحة التحكم
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            إظهار/إخفاء الأقسام، تغيير العرض، وسحب لترتيبها.
          </p>
          <div className="space-y-1">
            {sortedWidgets.map((w, idx) => (
              <div
                key={w.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-grab active:cursor-grabbing transition-colors ${
                  dragIdx === idx
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <Label
                    htmlFor={`widget-${w.id}`}
                    className="cursor-pointer font-medium text-sm"
                  >
                    {w.label}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  {/* Size toggle */}
                  <button
                    onClick={() => toggleSize(w.id)}
                    className={`p-1 rounded transition-colors ${
                      w.size === "full"
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title={w.size === "full" ? "عرض كامل" : "نص عرض"}
                  >
                    {w.size === "full" ? (
                      <Maximize2 className="h-3.5 w-3.5" />
                    ) : (
                      <Minimize2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <Switch
                    id={`widget-${w.id}`}
                    checked={w.visible}
                    onCheckedChange={() => toggleWidget(w.id)}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            <Maximize2 className="h-3 w-3 inline ml-1" />= عرض كامل &nbsp;
            <Minimize2 className="h-3 w-3 inline ml-1" />= نص عرض
          </p>
        </DialogContent>
      </Dialog>

      {/* ====== Quick Links Editor Dialog ====== */}
      <Dialog open={linksEditorOpen} onOpenChange={setLinksEditorOpen}>
        <DialogContent
          className="max-w-lg max-h-[85vh] overflow-y-auto"
          dir="rtl"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              تعديل الروابط السريعة
            </DialogTitle>
          </DialogHeader>

          {/* Current links list */}
          <div className="space-y-2 mb-4">
            {quickLinks.length === 0 && (
              <p className="text-center py-4 text-muted-foreground text-sm">
                لا توجد روابط
              </p>
            )}
            {quickLinks.map((link) => {
              const IconComp = ICON_MAP[link.icon] || Plus;
              return (
                <div
                  key={link.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-border hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${link.color}`}>
                      <IconComp className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{link.label}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {link.href}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => {
                        setEditingLink(link);
                        setLinkForm({
                          label: link.label,
                          href: link.href,
                          icon: link.icon,
                          color: link.color,
                        });
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                      onClick={() => deleteQuickLink(link.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add / Edit form */}
          <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
            <p className="text-sm font-semibold">
              {editingLink ? "تعديل الرابط" : "إضافة رابط جديد"}
            </p>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">الاسم</Label>
                <Input
                  value={linkForm.label}
                  onChange={(e) =>
                    setLinkForm((f) => ({ ...f, label: e.target.value }))
                  }
                  placeholder="مثلاً: فاتورة"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">الصفحة</Label>
                <select
                  value={linkForm.href}
                  onChange={(e) =>
                    setLinkForm((f) => ({ ...f, href: e.target.value }))
                  }
                  className="w-full h-8 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">اختر صفحة</option>
                  {ALL_PAGES.map((p) => (
                    <option key={p.href} value={p.href}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">الأيقونة</Label>
                <div className="flex flex-wrap gap-1 p-1.5 border rounded-md bg-background max-h-20 overflow-y-auto">
                  {ICON_OPTIONS.map((iconName) => {
                    const Ic = ICON_MAP[iconName];
                    return (
                      <button
                        key={iconName}
                        onClick={() =>
                          setLinkForm((f) => ({ ...f, icon: iconName }))
                        }
                        className={`p-1 rounded transition-colors ${
                          linkForm.icon === iconName
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                        title={iconName}
                      >
                        <Ic className="h-3.5 w-3.5" />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">اللون</Label>
                <div className="flex flex-wrap gap-1 p-1.5 border rounded-md bg-background">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() =>
                        setLinkForm((f) => ({ ...f, color: c.value }))
                      }
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${c.value} ${
                        linkForm.color === c.value
                          ? "ring-2 ring-primary ring-offset-1"
                          : ""
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {editingLink ? (
                <>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={updateQuickLink}
                  >
                    حفظ التعديل
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingLink(null);
                      setLinkForm({
                        label: "",
                        href: "",
                        icon: "Plus",
                        color: COLOR_OPTIONS[0].value,
                      });
                    }}
                  >
                    إلغاء
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={addQuickLink}
                  disabled={!linkForm.label || !linkForm.href}
                >
                  <Plus className="h-3.5 w-3.5 ml-1" />
                  إضافة
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-muted-foreground"
                onClick={resetQuickLinks}
                title="استعادة الافتراضي"
              >
                <RotateCcw className="h-3 w-3 ml-1" />
                افتراضي
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
