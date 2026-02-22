"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/services/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "../context/auth-context";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setMounted(true), []);

  // ✅ لو مسجل دخول قبل كده → يدخل تلقائي فوراً
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    if (token && storedUser) {
      router.replace("/");
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

      router.replace("/");
    } catch (err: any) {
      setError(err.response?.data?.error || "حدث خطأ أثناء تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-[420px] mx-auto p-10 shadow-2xl rounded-2xl">
        {/* 🔥 اللوجو */}
        <div className="flex justify-center mb-6">
          {/* Show both logos, CSS hides wrong one — avoids flash */}
          <img
            src="/logo-light.png"
            alt="Logo"
            className={`h-20 object-contain transition-all ${
              mounted ? "hidden dark:block" : "hidden"
            }`}
          />
          <img
            src="/logo-dark.png"
            alt="Logo"
            className={`h-20 object-contain transition-all ${
              mounted ? "block dark:hidden" : "hidden"
            }`}
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
