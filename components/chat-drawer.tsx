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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import api, { API_URL } from "@/services/api";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";

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
}

interface Conversation {
  id: number;
  updated_at: string;
  other_user: ChatUser | null;
  last_message: {
    content: string;
    created_at: string;
    sender_id: number;
  } | null;
  unread_count: number;
}

interface ChatDrawerProps {
  userId: number;
  branchId: number;
}

/* ========== Component ========== */
export function ChatDrawer({ userId, branchId }: ChatDrawerProps) {
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

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------- Audio: dual strategy (Web Audio API + HTML Audio fallback) ---------- */
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioUnlockedRef = useRef(false);
  const fallbackAudioRef = useRef<HTMLAudioElement | null>(null);

  // Helper: get or create AudioContext
  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctx) {
        audioCtxRef.current = new Ctx();
        console.log(
          "[sound] AudioContext created, state:",
          audioCtxRef.current.state,
        );
      }
    }
    return audioCtxRef.current;
  }, []);

  // Load buffer (mp3 for max compat, fallback to wav)
  const loadBuffer = useCallback(async (ctx: AudioContext) => {
    if (audioBufferRef.current) return;
    for (const src of ["/sounds/beepmasage.mp3", "/sounds/beepmasage.wav"]) {
      try {
        const res = await fetch(src);
        if (!res.ok) continue;
        const ab = await res.arrayBuffer();
        audioBufferRef.current = await ctx.decodeAudioData(ab);
        console.log("[sound] Buffer loaded from", src);
        return;
      } catch (e) {
        console.warn("[sound] Failed to load", src, e);
      }
    }
  }, []);

  useEffect(() => {
    // Pre-create fallback HTML Audio element
    const fa = new Audio("/sounds/beepmasage.mp3");
    fa.volume = 0.5;
    fa.preload = "auto";
    fallbackAudioRef.current = fa;

    // Unlock audio on user interaction
    const unlock = async () => {
      if (audioUnlockedRef.current) return;
      audioUnlockedRef.current = true;
      console.log("[sound] Unlocking audio...");

      // Strategy 1: Web Audio API — resume + play silent oscillator
      const ctx = getAudioCtx();
      if (ctx) {
        try {
          if (ctx.state === "suspended") await ctx.resume();
          // Play silent oscillator to fully unlock the pipeline
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          gain.gain.value = 0; // silent
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(0);
          osc.stop(ctx.currentTime + 0.001);
          console.log("[sound] AudioContext unlocked, state:", ctx.state);
          // Load the actual sound buffer
          loadBuffer(ctx);
        } catch (e) {
          console.warn("[sound] AudioContext unlock failed:", e);
        }
      }

      // Strategy 2: HTML Audio — warm it up with silent play
      try {
        const a = fallbackAudioRef.current;
        if (a) {
          a.muted = true;
          await a.play();
          a.pause();
          a.muted = false;
          a.currentTime = 0;
          console.log("[sound] HTML Audio unlocked");
        }
      } catch (e) {
        console.warn("[sound] HTML Audio unlock failed:", e);
      }
    };

    document.addEventListener("click", unlock, { capture: true });
    document.addEventListener("touchstart", unlock, { capture: true });
    document.addEventListener("touchend", unlock, { capture: true });

    return () => {
      document.removeEventListener("click", unlock, { capture: true });
      document.removeEventListener("touchstart", unlock, { capture: true });
      document.removeEventListener("touchend", unlock, { capture: true });
    };
  }, [getAudioCtx, loadBuffer]);

  const playSound = useCallback(() => {
    console.log(
      "[sound] playSound called, unlocked:",
      audioUnlockedRef.current,
    );

    // Strategy 1: Web Audio API (preferred — works from non-gesture contexts once unlocked)
    try {
      const ctx = audioCtxRef.current;
      const buffer = audioBufferRef.current;
      if (ctx && buffer && ctx.state === "running") {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gainNode = ctx.createGain();
        gainNode.gain.value = 0.5;
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(0);
        console.log("[sound] Played via Web Audio API");
        return;
      }
      console.log(
        "[sound] Web Audio not ready — ctx state:",
        ctx?.state,
        "buffer:",
        !!buffer,
      );
    } catch (e) {
      console.warn("[sound] Web Audio play error:", e);
    }

    // Strategy 2: HTML Audio fallback
    try {
      const a = fallbackAudioRef.current;
      if (a) {
        a.currentTime = 0;
        const p = a.play();
        if (p)
          p.catch((e: unknown) =>
            console.warn("[sound] HTML Audio play error:", e),
          );
        console.log("[sound] Played via HTML Audio fallback");
        return;
      }
    } catch (e) {
      console.warn("[sound] HTML Audio fallback error:", e);
    }

    // Strategy 3: Last resort — create fresh Audio
    try {
      const fresh = new Audio("/sounds/beepmasage.mp3");
      fresh.volume = 0.5;
      const p = fresh.play();
      if (p)
        p.catch((e: unknown) => console.warn("[sound] Fresh Audio error:", e));
      console.log("[sound] Played via fresh Audio");
    } catch (e) {
      console.warn("[sound] All strategies failed:", e);
    }
  }, []);

  /* ---------- scroll to bottom ---------- */
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
        scrollToBottom();

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
        // Check if we're viewing this conversation
        let isViewing = false;

        setActiveConv((current) => {
          if (current && current.id === conversation_id) {
            isViewing = true;
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
          }
          return current;
        });

        // Play sound outside state updater if not viewing
        setTimeout(() => {
          if (!isViewing) {
            playSound();
          }
        }, 50);

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
        },
      );
      setMessages((prev) => [...prev, data.data]);
      setNewMsg("");
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
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => {
            setOpen(true);
            setView("list");
            fetchConversations();
            fetchUnread();
          }}
        >
          <MessageCircle className="h-5 w-5" />
          {totalUnread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] bg-blue-600 text-white border-0">
              {totalUnread > 99 ? "99+" : totalUnread}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

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
                                : "") + conv.last_message.content
                            : "لا توجد رسائل"}
                        </p>
                        {conv.unread_count > 0 && (
                          <Badge className="h-5 min-w-5 px-1 text-[10px] bg-blue-600 text-white border-0 shrink-0">
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
                      className={cn(
                        "flex",
                        isMine ? "justify-start" : "justify-end",
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                          isMine
                            ? "bg-blue-600 text-white rounded-bl-sm"
                            : "bg-muted rounded-br-sm",
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                        <div
                          className={cn(
                            "flex items-center gap-1 mt-1",
                            isMine ? "justify-start" : "justify-end",
                          )}
                        >
                          <span
                            className={cn(
                              "text-[10px]",
                              isMine
                                ? "text-blue-200"
                                : "text-muted-foreground",
                            )}
                          >
                            {formatTime(msg.created_at)}
                          </span>
                          {isMine &&
                            (msg.is_read ? (
                              <CheckCheck className="h-3 w-3 text-blue-200" />
                            ) : (
                              <Check className="h-3 w-3 text-blue-300" />
                            ))}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {typing && (
                  <div className="flex justify-end">
                    <div className="bg-muted rounded-2xl rounded-br-sm px-4 py-2">
                      <span className="text-sm text-muted-foreground animate-pulse">
                        يكتب...
                      </span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="border-t p-3 flex items-center gap-2 shrink-0 safe-area-bottom">
              <Button
                size="icon"
                disabled={!newMsg.trim() || sending}
                onClick={handleSend}
                className="shrink-0 bg-blue-600 hover:bg-blue-700"
              >
                <Send className="h-4 w-4" />
              </Button>
              <Input
                placeholder="اكتب رسالة..."
                value={newMsg}
                onChange={(e) => {
                  setNewMsg(e.target.value);
                  handleTyping();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="flex-1"
                autoFocus
              />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
