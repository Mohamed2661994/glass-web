"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/app/context/auth-context";
import { useUserPreferences } from "@/hooks/use-user-preferences";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { user } = useAuth();
  const { prefs, loaded, setThemePref } = useUserPreferences();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  /* ── Sync server-side theme pref to next-themes on load ── */
  useEffect(() => {
    if (!loaded || !prefs.theme || !mounted) return;
    // Only apply if different from current to avoid loops
    if (prefs.theme !== resolvedTheme) {
      setTheme(prefs.theme);
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(prefs.theme);
      document.documentElement.style.colorScheme = prefs.theme;
    }
  }, [loaded, prefs.theme, mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = () => {
    const current = resolvedTheme || "light";
    const newTheme = current === "dark" ? "light" : "dark";

    // 1. Update next-themes
    setTheme(newTheme);

    // 2. Force DOM class immediately (safety net if next-themes is slow)
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(newTheme);
    document.documentElement.style.colorScheme = newTheme;

    // 3. Save for user
    if (user?.id) {
      localStorage.setItem(`theme_user_${user.id}`, newTheme);
      setThemePref(newTheme);
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleToggle}
      suppressHydrationWarning
    >
      {mounted ? (
        resolvedTheme === "dark" ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )
      ) : (
        <Sun className="h-4 w-4 opacity-0" />
      )}
    </Button>
  );
}
