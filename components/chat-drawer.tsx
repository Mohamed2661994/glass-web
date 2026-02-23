"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  MessageCircle,
  Send,
  ArrowRight,
  Plus,
  Check,
  CheckCheck,
  Search,
  X,
  Paperclip,
  Camera,
  FileText,
  Download,
  Reply,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import api, { API_URL } from "@/services/api";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import type { ChatPrefs } from "@/hooks/use-user-preferences";

/* ========== Types ========== */
interface ChatUser {
  id: number;
  username: string;
  full_name: string;
  branch_id: number;
}

interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  is_read: boolean;
  created_at: string;
  username: string;
  full_name: string;
  type?: "text" | "image" | "file";
  file_url?: string;
  reply_to_id?: number;
  reply_content?: string;
  reply_sender_id?: number;
  reply_sender_name?: string;
  reply_type?: string;
}

interface Conversation {
  id: number;
  updated_at: string;
  other_user: ChatUser | null;
  last_message: {
    content: string;
    created_at: string;
    sender_id: number;
    type?: "text" | "image" | "file";
    file_url?: string;
  } | null;
  unread_count: number;
}

interface ChatDrawerProps {
  userId: number;
  branchId: number;
}

/* ========== Component ========== */
export function ChatDrawer({ userId, branchId }: ChatDrawerProps) {
  const { prefs } = useUserPreferences();
  const chatPrefs: ChatPrefs = (prefs.chat as ChatPrefs) || {};
  const myColor = chatPrefs.myBubbleColor || "#2563eb";
  const otherColor = chatPrefs.otherBubbleColor || "";
  const soundFile = chatPrefs.notificationSound || "beepmasage.mp3";

  // Resolve sound URL: Cloudinary returns full https:// URLs, old uploads use API_URL, built-in use /sounds/
  const getSoundUrl = useCallback(
    (sf: string) =>
      sf.startsWith("http")
        ? sf
        : sf.startsWith("/uploads/")
          ? `${API_URL}${sf}`
          : `/sounds/${sf}`,
    [],
  );

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "chat" | "new">("list");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [typing, setTyping] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<number | null>(null);
  const [popup, setPopup] = useState<{
    senderName: string;
    preview: string;
    conversationId: number;
  } | null>(null);
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openRef = useRef(false);
  const viewRef = useRef<"list" | "chat" | "new">("list");
  const activeConvIdRef = useRef<number | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const openConvRef = useRef<(conv: Conversation) => void>(() => {});

  // Keep refs in sync with state so socket handler can read latest values
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  useEffect(() => {
    activeConvIdRef.current = activeConv?.id ?? null;
  }, [activeConv]);

  /* ---------- File upload refs ---------- */
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [uploading, setUploading] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  /* ---------- Audio notification (PWA-safe) ---------- */
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioReadyRef = useRef(false);
  const bufferLoadingRef = useRef(false);
  const soundFileRef = useRef(soundFile);

  // Reload buffer when sound file changes
  useEffect(() => {
    if (soundFileRef.current !== soundFile) {
      soundFileRef.current = soundFile;
      audioBufferRef.current = null;
      bufferLoadingRef.current = false;
      if (soundFile !== "none" && audioCtxRef.current) {
        // reload
        (async () => {
          try {
            bufferLoadingRef.current = true;
            const res = await fetch(getSoundUrl(soundFile));
            if (!res.ok) throw new Error("fetch " + res.status);
            const ab = await res.arrayBuffer();
            audioBufferRef.current =
              await audioCtxRef.current!.decodeAudioData(ab);
          } catch {
            bufferLoadingRef.current = false;
          }
        })();
      }
    }
  }, [soundFile, getSoundUrl]);

  // Load the mp3 into the AudioContext buffer
  const loadBuffer = useCallback(async () => {
    if (audioBufferRef.current || bufferLoadingRef.current) return;
    if (soundFile === "none") return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    bufferLoadingRef.current = true;
    try {
      const res = await fetch(getSoundUrl(soundFile));
      if (!res.ok) throw new Error("fetch " + res.status);
      const ab = await res.arrayBuffer();
      audioBufferRef.current = await ctx.decodeAudioData(ab);
      console.log("[sound] buffer loaded ✓");
    } catch (e) {
      console.warn("[sound] buffer load error:", e);
      bufferLoadingRef.current = false;
    }
  }, [soundFile, getSoundUrl]);

  useEffect(() => {
    // On first user gesture: CREATE AudioContext + resume + silent oscillator + load buffer
    // Creating AudioContext INSIDE the gesture handler is required for iOS PWA standalone mode
    const unlock = () => {
      if (audioReadyRef.current) return;

      try {
        // Create AudioContext inside gesture (required for iOS PWA)
        if (!audioCtxRef.current) {
          const Ctx = window.AudioContext || (window as any).webkitAudioContext;
          if (!Ctx) return;
          audioCtxRef.current = new Ctx();
          console.log(
            "[sound] ctx created in gesture, state:",
            audioCtxRef.current.state,
          );
        }

        const ctx = audioCtxRef.current;

        // Resume synchronously in gesture handler
        if (ctx.state === "suspended") {
          ctx.resume();
        }

        // Play silent oscillator to fully activate the pipeline
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(0);
        osc.stop(ctx.currentTime + 0.05);

        audioReadyRef.current = true;
        console.log("[sound] UNLOCKED ✓ state:", ctx.state);

        // Now load the actual audio file
        loadBuffer();
      } catch (e) {
        console.warn("[sound] unlock error:", e);
      }
    };

    // Use every possible event type, capture phase, passive
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    const events = [
      "touchstart",
      "touchend",
      "pointerdown",
      "click",
      "keydown",
    ];
    events.forEach((evt) => document.addEventListener(evt, unlock, opts));

    return () => {
      events.forEach((evt) =>
        document.removeEventListener(evt, unlock, opts as EventListenerOptions),
      );
    };
  }, [soundFile, loadBuffer]);

  const playSound = useCallback(() => {
    if (soundFile === "none") return;
    console.log(
      "[sound] playSound — ready:",
      audioReadyRef.current,
      "buffer:",
      !!audioBufferRef.current,
      "ctx:",
      audioCtxRef.current?.state,
    );

    let played = false;

    // Strategy 1: Web Audio API
    const ctx = audioCtxRef.current;
    const buffer = audioBufferRef.current;
    if (ctx && buffer) {
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      try {
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const g = ctx.createGain();
        g.gain.value = 0.7;
        src.connect(g);
        g.connect(ctx.destination);
        src.start(0);
        played = true;
        console.log("[sound] ✓ played via WebAudio");
      } catch (e) {
        console.warn("[sound] WebAudio error:", e);
      }
    }

    // Strategy 2: HTML Audio fallback — only if WebAudio didn't play
    if (!played) {
      try {
        const audio = new Audio(getSoundUrl(soundFile));
        audio.volume = 0.7;
        const p = audio.play();
        if (p) p.catch(() => {});
        console.log("[sound] ✓ played via HTML Audio fallback");
      } catch {}
    }

    // Vibrate on mobile
    try {
      navigator?.vibrate?.(200);
    } catch {}
  }, [soundFile, getSoundUrl]);

  /* ---------- scroll to bottom ---------- */
  const scrollToBottom = useCallback((instant?: boolean) => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: instant ? "instant" : "smooth",
      });
    }, 100);
  }, []);

  /* ---------- fetch conversations ---------- */
  const fetchConversations = useCallback(async () => {
    try {
      const { data } = await api.get("/chat/conversations");
      setConversations(data.data ?? []);
    } catch {
      /* silent */
    }
  }, []);

  /* ---------- file upload handler ---------- */
  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!activeConv || uploading) return;
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const { data } = await api.post(
          `/chat/conversations/${activeConv.id}/upload`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } },
        );
        setMessages((prev) => [...prev, data.data]);
        scrollToBottom();
        fetchConversations();
      } catch {
        toast.error("فشل رفع الملف");
      } finally {
        setUploading(false);
      }
    },
    [activeConv, uploading, scrollToBottom, fetchConversations],
  );

  /* ---------- fetch unread count ---------- */
  const fetchUnread = useCallback(async () => {
    try {
      const { data } = await api.get("/chat/unread-count");
      setTotalUnread(data.count ?? 0);
    } catch {
      /* silent */
    }
  }, []);

  /* ---------- fetch messages ---------- */
  const fetchMessages = useCallback(
    async (convId: number) => {
      try {
        const { data } = await api.get(
          `/chat/conversations/${convId}/messages`,
        );
        setMessages(data.data ?? []);
        scrollToBottom(true);

        // Notify sender that messages were read
        const otherUserId = activeConv?.other_user?.id;
        if (otherUserId && socketRef.current) {
          socketRef.current.emit("chat_messages_read", {
            conversation_id: convId,
            reader_id: userId,
            to_user_id: otherUserId,
          });
        }

        // Refresh unread & conversations
        fetchUnread();
        fetchConversations();
      } catch {
        /* silent */
      }
    },
    [
      scrollToBottom,
      fetchUnread,
      fetchConversations,
      activeConv?.other_user?.id,
      userId,
    ],
  );

  /* ---------- initial load ---------- */
  useEffect(() => {
    fetchConversations();
    fetchUnread();
  }, [fetchConversations, fetchUnread]);

  /* ---------- socket connection ---------- */
  useEffect(() => {
    const socket = io(API_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("register_user", { user_id: userId });
    });

    socket.on(
      "new_message",
      ({
        conversation_id,
        message,
      }: {
        conversation_id: number;
        message: Message;
      }) => {
        // Is the user actively viewing THIS specific conversation?
        const isViewingThisConv =
          openRef.current &&
          viewRef.current === "chat" &&
          activeConvIdRef.current === conversation_id;

        setActiveConv((current) => {
          if (isViewingThisConv && current && current.id === conversation_id) {
            setMessages((prev) => [...prev, message]);
            scrollToBottom();

            // Mark as read since we're viewing
            api
              .get(`/chat/conversations/${conversation_id}/messages`)
              .catch(() => {});
            socket.emit("chat_messages_read", {
              conversation_id,
              reader_id: userId,
              to_user_id: message.sender_id,
            });
            return current;
          }
          return current;
        });

        // Play sound unless actively reading this exact conversation
        // (chat drawer open + chat view + same conversation)
        playSound();

        // Show popup notification below chat icon if not viewing this conversation
        if (!isViewingThisConv) {
          const senderName =
            message.full_name || message.username || "رسالة جديدة";
          const preview =
            message.type === "image"
              ? "📷 صورة"
              : message.type === "file"
                ? "📄 ملف"
                : message.content?.length > 60
                  ? message.content.slice(0, 60) + "…"
                  : message.content;

          if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
          setPopup({ senderName, preview, conversationId: conversation_id });
          popupTimerRef.current = setTimeout(() => setPopup(null), 4000);
        }

        // Always refresh conversations list & unread
        fetchConversations();
        fetchUnread();
      },
    );

    socket.on(
      "chat_typing",
      ({ conversation_id }: { conversation_id: number }) => {
        setActiveConv((current) => {
          if (current && current.id === conversation_id) {
            setTyping(true);
          }
          return current;
        });
      },
    );

    socket.on(
      "chat_stop_typing",
      ({ conversation_id }: { conversation_id: number }) => {
        setActiveConv((current) => {
          if (current && current.id === conversation_id) {
            setTyping(false);
          }
          return current;
        });
      },
    );

    socket.on(
      "chat_messages_read",
      ({ conversation_id }: { conversation_id: number }) => {
        setActiveConv((current) => {
          if (current && current.id === conversation_id) {
            setMessages((prev) => prev.map((m) => ({ ...m, is_read: true })));
          }
          return current;
        });
      },
    );

    return () => {
      socket.disconnect();
    };
  }, [userId, playSound, scrollToBottom, fetchConversations, fetchUnread]);

  /* ---------- send message ---------- */
  const handleSend = async () => {
    if (!newMsg.trim() || !activeConv || sending) return;
    setSending(true);
    try {
      const { data } = await api.post(
        `/chat/conversations/${activeConv.id}/messages`,
        {
          content: newMsg.trim(),
          reply_to_id: replyTo?.id || null,
        },
      );
      setMessages((prev) => [...prev, data.data]);
      setNewMsg("");
      setReplyTo(null);
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      scrollToBottom();
      fetchConversations();

      // stop typing
      if (activeConv.other_user && socketRef.current) {
        socketRef.current.emit("chat_stop_typing", {
          conversation_id: activeConv.id,
          user_id: userId,
          to_user_id: activeConv.other_user.id,
        });
      }
    } catch {
      /* silent */
    } finally {
      setSending(false);
    }
  };

  /* ---------- typing indicator ---------- */
  const handleTyping = () => {
    if (!activeConv?.other_user || !socketRef.current) return;

    socketRef.current.emit("chat_typing", {
      conversation_id: activeConv.id,
      user_id: userId,
      to_user_id: activeConv.other_user.id,
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit("chat_stop_typing", {
        conversation_id: activeConv.id,
        user_id: userId,
        to_user_id: activeConv.other_user!.id,
      });
    }, 2000);
  };

  /* ---------- open conversation ---------- */
  const openConversation = (conv: Conversation) => {
    setActiveConv(conv);
    setView("chat");
    setTyping(false);
    fetchMessages(conv.id);
  };

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  useEffect(() => {
    openConvRef.current = openConversation;
  });

  /* ---------- start new conversation ---------- */
  const startNewConversation = async (otherUser: ChatUser) => {
    try {
      const { data } = await api.post("/chat/conversations", {
        other_user_id: otherUser.id,
      });
      const convId = data.conversation_id;

      const conv: Conversation = {
        id: convId,
        updated_at: new Date().toISOString(),
        other_user: otherUser,
        last_message: null,
        unread_count: 0,
      };

      setActiveConv(conv);
      setView("chat");
      fetchMessages(convId);
      fetchConversations();
    } catch (err) {
      console.error("START CONVERSATION ERROR:", err);
      toast.error("فشل فتح المحادثة");
    }
  };

  /* ---------- open new chat view ---------- */
  const openNewChat = async () => {
    setView("new");
    setUserSearch("");
    try {
      const { data } = await api.get("/chat/users");
      setAllUsers(data.data ?? []);
    } catch {
      /* silent */
    }
  };

  /* ---------- time helpers ---------- */
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "الآن";
    if (mins < 60) return `منذ ${mins} د`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `منذ ${hours} س`;
    const days = Math.floor(hours / 24);
    return `منذ ${days} يوم`;
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const branchLabel = (bid: number) =>
    bid === 1 ? "قطاعي" : bid === 2 ? "جملة" : `فرع ${bid}`;

  const displayName = (u: ChatUser | null) =>
    u ? u.full_name || u.username : "محذوف";

  /* ---------- filtered users for new chat ---------- */
  const filteredUsers = allUsers.filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      (u.full_name || "").toLowerCase().includes(q)
    );
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div className="relative">
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => {
              setOpen(true);
              setView("list");
              setPopup(null);
              fetchConversations();
              fetchUnread();
            }}
          >
            <MessageCircle className="h-5 w-5" />
            {totalUnread > 0 && (
              <Badge
                className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] text-white border-0"
                style={{ backgroundColor: myColor }}
              >
                {totalUnread > 99 ? "99+" : totalUnread}
              </Badge>
            )}
          </Button>
        </SheetTrigger>

        {/* Notification popup below chat icon */}
        {popup && (
          <div
            onClick={() => {
              setPopup(null);
              setOpen(true);
              const conv = conversationsRef.current.find(
                (c) => c.id === popup.conversationId,
              );
              if (conv) {
                openConvRef.current(conv);
              }
            }}
            className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-64 cursor-pointer rounded-xl border bg-background p-3 shadow-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold"
              style={{ backgroundColor: myColor }}
            >
              {popup.senderName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">
                {popup.senderName}
              </p>
              <p
                className="text-xs text-muted-foreground truncate mt-0.5"
                dir="auto"
              >
                {popup.preview}
              </p>
            </div>
          </div>
        )}
      </div>

      <SheetContent
        side="left"
        className="w-full sm:w-[400px] sm:max-w-[400px] p-0 flex flex-col gap-0 h-[100dvh] [&>button]:hidden"
      >
        {/* ====== HEADER ====== */}
        <div className="border-b px-4 py-3 flex items-center justify-between shrink-0 safe-area-top">
          {view === "list" ? (
            <>
              <h2 className="text-lg font-bold">المحادثات</h2>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={openNewChat}>
                  <Plus className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </>
          ) : view === "new" ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setView("list")}
              >
                <ArrowRight className="h-5 w-5" />
              </Button>
              <h2 className="text-lg font-bold flex-1 text-center">
                محادثة جديدة
              </h2>
              <div className="w-9" />
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setView("list");
                  fetchConversations();
                }}
              >
                <ArrowRight className="h-5 w-5" />
              </Button>
              <div className="flex-1 text-center">
                <h2 className="text-sm font-bold">
                  {displayName(activeConv?.other_user ?? null)}
                </h2>
                {typing && (
                  <span className="text-xs text-green-500 animate-pulse">
                    يكتب...
                  </span>
                )}
              </div>
              <div className="w-9" />
            </>
          )}
        </div>

        {/* ====== CONVERSATIONS LIST ====== */}
        {view === "list" && (
          <ScrollArea className="flex-1">
            {conversations.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground text-sm">
                لا توجد محادثات بعد
                <br />
                <Button variant="link" onClick={openNewChat} className="mt-2">
                  ابدأ محادثة جديدة
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "w-full flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors text-right cursor-pointer",
                      conv.unread_count > 0 &&
                        "bg-blue-50/50 dark:bg-blue-950/20",
                    )}
                    onClick={() => openConversation(conv)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") openConversation(conv);
                    }}
                  >
                    {/* Avatar */}
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {displayName(conv.other_user)[0]?.toUpperCase() || "?"}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "text-sm font-semibold truncate",
                            conv.unread_count > 0 && "font-bold",
                          )}
                        >
                          {displayName(conv.other_user)}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {conv.last_message
                            ? timeAgo(conv.last_message.created_at)
                            : ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1 gap-2">
                        <p
                          className={cn(
                            "text-xs truncate flex-1",
                            conv.unread_count > 0
                              ? "text-foreground font-medium"
                              : "text-muted-foreground",
                          )}
                        >
                          {conv.last_message
                            ? (conv.last_message.sender_id === userId
                                ? "أنت: "
                                : "") +
                              (conv.last_message.type === "image"
                                ? "📷 صورة"
                                : conv.last_message.type === "file"
                                  ? "📄 ملف"
                                  : conv.last_message.content)
                            : "لا توجد رسائل"}
                        </p>
                        {conv.unread_count > 0 && (
                          <Badge
                            className="h-5 min-w-5 px-1 text-[10px] text-white border-0 shrink-0"
                            style={{ backgroundColor: myColor }}
                          >
                            {conv.unread_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        )}

        {/* ====== NEW CONVERSATION ====== */}
        {view === "new" && (
          <div className="flex-1 flex flex-col">
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث عن مستخدم..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pr-9"
                  autoFocus
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="divide-y">
                {filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    role="button"
                    tabIndex={0}
                    className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-right cursor-pointer"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      startNewConversation(u);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") startNewConversation(u);
                    }}
                  >
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {(u.full_name || u.username)[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {u.full_name || u.username}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        @{u.username} · {branchLabel(u.branch_id)}
                      </p>
                    </div>
                  </div>
                ))}
                {filteredUsers.length === 0 && (
                  <div className="p-10 text-center text-muted-foreground text-sm">
                    لا يوجد مستخدمين
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* ====== CHAT VIEW ====== */}
        {view === "chat" && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Messages */}
            <ScrollArea className="flex-1 min-h-0 p-4">
              <div className="space-y-3">
                {messages.map((msg) => {
                  const isMine = msg.sender_id === userId;
                  return (
                    <div
                      key={msg.id}
                      data-msg-id={msg.id}
                      className={cn(
                        "flex items-end gap-1 group transition-colors duration-500",
                        isMine ? "justify-end" : "justify-start",
                        highlightedMsgId === msg.id &&
                          "bg-blue-500/20 rounded-lg",
                      )}
                    >
                      {/* Reply button - left side for my messages */}
                      {isMine && (
                        <button
                          onClick={() => {
                            setReplyTo(msg);
                            textareaRef.current?.focus();
                          }}
                          className="p-1 rounded-full hover:bg-muted mb-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                          title="رد"
                        >
                          <Reply className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl text-sm overflow-hidden",
                          msg.type === "image" ? "p-1" : "px-4 py-2",
                          isMine
                            ? "text-white rounded-br-sm"
                            : otherColor
                              ? "rounded-bl-sm"
                              : "bg-muted rounded-bl-sm",
                        )}
                        style={
                          isMine
                            ? { backgroundColor: myColor }
                            : otherColor
                              ? { backgroundColor: otherColor }
                              : undefined
                        }
                      >
                        {/* Quoted reply */}
                        {msg.reply_to_id && (
                          <div
                            className={cn(
                              "rounded-lg px-3 py-1.5 mb-2 border-r-2 text-xs cursor-pointer hover:opacity-80",
                              isMine
                                ? "border-r-white/40"
                                : "border-r-blue-500",
                            )}
                            style={
                              isMine
                                ? { backgroundColor: "rgba(0,0,0,0.15)" }
                                : { backgroundColor: "rgba(0,0,0,0.05)" }
                            }
                            onClick={() => {
                              const el = document.querySelector(
                                `[data-msg-id="${msg.reply_to_id}"]`,
                              );
                              if (el) {
                                el.scrollIntoView({
                                  behavior: "smooth",
                                  block: "center",
                                });
                                setHighlightedMsgId(msg.reply_to_id!);
                                setTimeout(
                                  () => setHighlightedMsgId(null),
                                  1500,
                                );
                              }
                            }}
                          >
                            <span
                              className={cn(
                                "font-semibold block text-[11px]",
                                isMine ? "text-white/80" : "text-blue-600",
                              )}
                            >
                              {msg.reply_sender_id === userId
                                ? "أنت"
                                : msg.reply_sender_name}
                            </span>
                            <span
                              className={cn(
                                "line-clamp-2",
                                isMine
                                  ? "text-white/60"
                                  : "text-muted-foreground",
                              )}
                            >
                              {msg.reply_type === "image"
                                ? "📷 صورة"
                                : msg.reply_type === "file"
                                  ? "📄 ملف"
                                  : msg.reply_content}
                            </span>
                          </div>
                        )}
                        {/* Message content by type */}
                        {msg.type === "image" && msg.file_url ? (
                          <div
                            className="cursor-pointer"
                            onClick={() =>
                              setPreviewImg(
                                msg.file_url!.startsWith("http")
                                  ? msg.file_url!
                                  : `${API_URL}${msg.file_url}`,
                              )
                            }
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={
                                msg.file_url.startsWith("http")
                                  ? msg.file_url
                                  : `${API_URL}${msg.file_url}`
                              }
                              alt={msg.content || "صورة"}
                              className="rounded-xl max-w-full max-h-64 object-cover"
                              loading="lazy"
                            />
                          </div>
                        ) : msg.type === "file" && msg.file_url ? (
                          <a
                            href={
                              msg.file_url.startsWith("http")
                                ? msg.file_url
                                : `${API_URL}${msg.file_url}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "flex items-center gap-2 py-1",
                              isMine
                                ? "text-white hover:text-blue-100"
                                : "text-foreground hover:text-muted-foreground",
                            )}
                          >
                            <Download className="h-4 w-4 shrink-0" />
                            <span className="whitespace-pre-wrap break-words text-sm underline">
                              {msg.content || "ملف"}
                            </span>
                          </a>
                        ) : (
                          <p className="whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>
                        )}
                        <div
                          className={cn(
                            "flex items-center gap-1 mt-1",
                            isMine ? "justify-end" : "justify-start",
                          )}
                        >
                          <span
                            className={cn(
                              "text-[10px]",
                              isMine
                                ? "text-white/60"
                                : "text-muted-foreground",
                            )}
                          >
                            {formatTime(msg.created_at)}
                          </span>
                          {isMine &&
                            (msg.is_read ? (
                              <CheckCheck className="h-3 w-3 text-white/60" />
                            ) : (
                              <Check className="h-3 w-3 text-white/70" />
                            ))}
                        </div>
                      </div>
                      {/* Reply button - right side for their messages */}
                      {!isMine && (
                        <button
                          onClick={() => {
                            setReplyTo(msg);
                            textareaRef.current?.focus();
                          }}
                          className="p-1 rounded-full hover:bg-muted mb-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                          title="رد"
                        >
                          <Reply className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {typing && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2">
                      <span className="text-sm text-muted-foreground animate-pulse">
                        يكتب...
                      </span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Hidden file inputs */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="*/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
                e.target.value = "";
              }}
            />
            <input
              type="file"
              ref={cameraInputRef}
              className="hidden"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
                e.target.value = "";
              }}
            />

            {/* Reply preview */}
            {replyTo && (
              <div className="border-t bg-muted/50 px-3 py-2 flex items-center gap-2">
                <div className="flex-1 border-r-2 border-r-blue-500 pr-2 min-w-0">
                  <span className="text-xs font-semibold text-blue-600 block">
                    {replyTo.sender_id === userId ? "أنت" : replyTo.full_name}
                  </span>
                  <span className="text-xs text-muted-foreground line-clamp-1">
                    {replyTo.type === "image"
                      ? "📷 صورة"
                      : replyTo.type === "file"
                        ? "📄 ملف"
                        : replyTo.content}
                  </span>
                </div>
                <button
                  onClick={() => setReplyTo(null)}
                  className="shrink-0 p-1 rounded-full hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            )}

            {/* Input */}
            <div className="border-t p-3 flex items-center gap-2 shrink-0 safe-area-bottom">
              <Button
                size="icon"
                disabled={!newMsg.trim() || sending}
                onClick={handleSend}
                className="shrink-0 text-white hover:opacity-90"
                style={{ backgroundColor: myColor }}
              >
                <Send className="h-4 w-4" />
              </Button>
              <textarea
                ref={textareaRef}
                placeholder="اكتب رسالة..."
                value={newMsg}
                onChange={(e) => {
                  setNewMsg(e.target.value);
                  handleTyping();
                  // Auto-grow
                  e.target.style.height = "auto";
                  e.target.style.height =
                    Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  for (let i = 0; i < items.length; i++) {
                    if (items[i].type.startsWith("image/")) {
                      e.preventDefault();
                      const file = items[i].getAsFile();
                      if (file) {
                        const named = new File(
                          [file],
                          `paste_${Date.now()}.png`,
                          { type: file.type },
                        );
                        handleFileUpload(named);
                      }
                      return;
                    }
                  }
                }}
                onKeyDown={(e) => {
                  // On mobile/touch devices, Enter = new line. On desktop, Enter = send, Shift+Enter = new line.
                  const isMobile =
                    "ontouchstart" in window || navigator.maxTouchPoints > 0;
                  if (e.key === "Enter" && !e.shiftKey && !isMobile) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
                className="flex-1 resize-none overflow-y-auto rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                style={{ maxHeight: 120 }}
                autoFocus
              />
              <Popover open={attachOpen} onOpenChange={setAttachOpen}>
                <PopoverTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0"
                    disabled={uploading}
                  >
                    {uploading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Paperclip className="h-4 w-4" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="end" className="w-48 p-2">
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
                    onClick={() => {
                      setAttachOpen(false);
                      fileInputRef.current?.click();
                    }}
                  >
                    <FileText className="h-4 w-4" />
                    <span>ارسال ملف</span>
                  </button>
                  {"ontouchstart" in globalThis && (
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
                      onClick={() => {
                        setAttachOpen(false);
                        cameraInputRef.current?.click();
                      }}
                    >
                      <Camera className="h-4 w-4" />
                      <span>التقاط صورة</span>
                    </button>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}
      </SheetContent>

      {/* Image preview modal */}
      <Dialog open={!!previewImg} onOpenChange={() => setPreviewImg(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] p-2 flex items-center justify-center bg-black/90 border-none">
          <DialogTitle className="sr-only">معاينة الصورة</DialogTitle>
          {previewImg && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewImg}
              alt="معاينة"
              className="w-full h-full object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
