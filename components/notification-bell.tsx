"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Bell, CheckCheck, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import api, { API_URL } from "@/services/api";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  reference_id: number | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationBellProps {
  userId: number;
  branchId: number;
}

export function NotificationBell({ userId, branchId }: NotificationBellProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /* ---------- preload audio ---------- */
  useEffect(() => {
    const audio = new Audio("/sounds/notification.wav");
    audio.volume = 0.7;
    audioRef.current = audio;

    // Warm up audio on first user interaction (browser autoplay policy)
    const unlock = () => {
      audio.load();
      document.removeEventListener("click", unlock);
    };
    document.addEventListener("click", unlock, { once: true });

    return () => document.removeEventListener("click", unlock);
  }, []);

  /* ---------- play sound helper ---------- */
  const playSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, []);

  /* ---------- fetch notifications ---------- */
  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get("/notifications");
      setNotifications(data.data ?? []);
      setUnreadCount(
        (data.data ?? []).filter((n: Notification) => !n.is_read).length,
      );
    } catch {
      /* silent */
    }
  }, []);

  /* ---------- initial load ---------- */
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  /* ---------- socket connection ---------- */
  useEffect(() => {
    const socket = io(API_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("register_user", { user_id: userId });
    });

    socket.on(
      "new_notification",
      (payload: Omit<Notification, "id" | "is_read" | "created_at">) => {
        // Add to top of list
        const newNotif: Notification = {
          id: Date.now(), // temp id until refresh
          ...payload,
          is_read: false,
          created_at: new Date().toISOString(),
        };
        setNotifications((prev) => [newNotif, ...prev]);
        setUnreadCount((c) => c + 1);
        playSound();
      },
    );

    return () => {
      socket.disconnect();
    };
  }, [userId, playSound]);

  /* ---------- mark one as read ---------- */
  const markRead = async (notif: Notification) => {
    if (!notif.is_read) {
      try {
        await api.put(`/notifications/${notif.id}/read`);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        /* silent */
      }
    }

    // Navigate to invoice if it's an invoice notification
    if (notif.type === "invoice_wholesale" && notif.reference_id) {
      setOpen(false);
      router.push(`/invoices/${notif.reference_id}`);
    }
  };

  /* ---------- mark all as read ---------- */
  const markAllRead = async () => {
    try {
      await api.put("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      /* silent */
    }
  };

  /* ---------- format time ---------- */
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "الآن";
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `منذ ${hrs} ساعة`;
    const days = Math.floor(hrs / 24);
    return `منذ ${days} يوم`;
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) fetchNotifications(); // refresh to get real IDs
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold text-sm">الإشعارات</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 gap-1"
              onClick={markAllRead}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              قراءة الكل
            </Button>
          )}
        </div>

        {/* Notifications list */}
        <ScrollArea className="h-[320px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-40" />
              <span className="text-sm">لا توجد إشعارات</span>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => markRead(notif)}
                  className={cn(
                    "w-full text-right px-4 py-3 hover:bg-muted/50 transition-colors flex gap-3 items-start",
                    !notif.is_read && "bg-blue-50 dark:bg-blue-950/30",
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    <FileText className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm",
                        !notif.is_read && "font-semibold",
                      )}
                    >
                      {notif.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {notif.message}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {timeAgo(notif.created_at)}
                    </p>
                  </div>
                  {!notif.is_read && (
                    <div className="mt-2 shrink-0">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
