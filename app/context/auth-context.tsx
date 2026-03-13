"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/services/api";
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
  setUser: (user: User | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (!token) {
      localStorage.removeItem("user");
      setUser(null);
      return;
    }

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("user");
      }
    }

    let isCancelled = false;

    const refreshCurrentUser = async () => {
      try {
        const res = await api.get("/auth/me");
        const freshUser = res.data?.user;

        if (!freshUser || isCancelled) {
          return;
        }

        setUser(freshUser);
        localStorage.setItem("user", JSON.stringify(freshUser));
      } catch {
        if (isCancelled) {
          return;
        }

        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);

        if (!window.location.pathname.includes("/login")) {
          router.push("/login");
        }
      }
    };

    refreshCurrentUser();

    const handleWindowFocus = () => {
      refreshCurrentUser();
    };

    window.addEventListener("focus", handleWindowFocus);

    return () => {
      isCancelled = true;
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, []);

  const logout = async () => {
    // تسجيل الخروج في السيرفر (بدون انتظار لو فشل)
    try {
      await api.post("/logout");
    } catch {
      // لو فشل التسجيل مش نوقف الخروج
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
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
