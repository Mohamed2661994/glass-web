"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/services/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "../context/auth-context";
import { useTheme } from "next-themes";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const { theme } = useTheme();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ لو مسجل دخول قبل كده يروح للدashboard
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      router.push("/");
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/login", {
        username,
        password,
      });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      setUser(res.data.user);

      router.push("/");
    } catch (err: any) {
      setError(err.response?.data?.error || "حدث خطأ أثناء تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <Card className="w-[500] max-w-[420px] mx-auto p-10 shadow-2xl rounded-2xl">
        {/* 🔥 اللوجو */}
        <div className="flex justify-center mb-6">
          <img
            src={theme === "dark" ? "/logo-light.png" : "/logo-dark.png"}
            alt="Logo"
            className="h-20 object-contain transition-all"
          />
        </div>

        <h2 className="text-2xl font-bold text-center mb-6">تسجيل الدخول</h2>

        <form onSubmit={handleLogin} className="space-y-5 px-2">
          <Input
            placeholder="اسم المستخدم"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          <Input
            type="password"
            placeholder="كلمة المرور"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <div className="text-sm text-red-500 text-center">{error}</div>
          )}

          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading ? "جاري الدخول..." : "دخول"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
