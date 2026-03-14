"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import api, { API_URL } from "@/services/api";
import type { UserPermissions } from "@/lib/permissions";

interface User {
  id: number;
  username: string;
  branch_id: number;
  theme?: string;
  full_name?: string;
  role?: string;
  permissions?: Partial<UserPermissions>;
}

interface AuthContextType {
  user: User | null;
  authReady: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    setSessionToken(token);

    if (!token) {
      localStorage.removeItem("user");
      setUserState(null);
      setAuthReady(true);
      return;
    }

    if (storedUser) {
      try {
        setUserState(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("user");
      }
    }

    setAuthReady(false);
  }, []);

  const setUser = useCallback((nextUser: User | null) => {
    setUserState(nextUser);

    if (typeof window === "undefined") {
      return;
    }

    setSessionToken(localStorage.getItem("token"));

    if (nextUser) {
      localStorage.setItem("user", JSON.stringify(nextUser));
    } else {
      localStorage.removeItem("user");
    }
  }, []);

  const clearSession = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }

    setSessionToken(null);
    setUserState(null);
  }, []);

  useEffect(() => {
    if (!sessionToken || typeof window === "undefined") {
      return;
    }

    let isCancelled = false;
    let socket: Socket | null = null;

    const refreshCurrentUser = async () => {
      try {
        const res = await api.get("/auth/me");
        const freshUser = res.data?.user;

        if (!freshUser || isCancelled) {
          return;
        }

        setUserState(freshUser);
        localStorage.setItem("user", JSON.stringify(freshUser));
      } catch {
        if (isCancelled) {
          return;
        }

        clearSession();

        if (!window.location.pathname.includes("/login")) {
          router.push("/login");
        }
      } finally {
        if (!isCancelled) {
          setAuthReady(true);
        }
      }
    };

    setAuthReady(false);
    refreshCurrentUser();

    socket = io(API_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: Infinity,
    });

    socket.on("connect", () => {
      socket?.emit("register_user", {
        user_id: JSON.parse(localStorage.getItem("user") || "null")?.id,
      });
    });

    socket.on("data:users", () => {
      refreshCurrentUser();
    });

    const handleWindowFocus = () => {
      refreshCurrentUser();
    };

    window.addEventListener("focus", handleWindowFocus);

    return () => {
      isCancelled = true;
      window.removeEventListener("focus", handleWindowFocus);
      socket?.disconnect();
    };
  }, [clearSession, router, sessionToken]);

  const logout = async () => {
    // تسجيل الخروج في السيرفر (بدون انتظار لو فشل)
    try {
      await api.post("/logout");
    } catch {
      // لو فشل التسجيل مش نوقف الخروج
    }
    clearSession();
    setAuthReady(true);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, authReady, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
