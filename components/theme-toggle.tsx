"use client";

import { useEffect, useRef, useState } from "react";
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
  // Tracks whether the initial one-time sync has fired for this user session.
  // Prevents a stale backend response from reverting the theme after the user toggles.
  const initialSyncDone = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset sync flag whenever the user changes (login/logout)
  useEffect(() => {
    initialSyncDone.current = false;
  }, [user?.id]);

  /* ── Sync server-side theme pref to next-themes — ONE TIME per session ── */
  useEffect(() => {
    if (!loaded || !prefs.theme || !mounted) return;
    if (initialSyncDone.current) return; // already synced once — don't let backend override later
    initialSyncDone.current = true;
    // The head script already applied the correct class before first paint.
    // Only override if next-themes resolved to something different.
    if (prefs.theme !== resolvedTheme) {
      setTheme(prefs.theme);
    }
    // Keep localStorage.theme in sync so next-themes finds the right value on next load
    localStorage.setItem("theme", prefs.theme);
  }, [loaded, prefs.theme, mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggle = () => {
    const current =
      resolvedTheme === "dark"
        ? "dark"
        : resolvedTheme === "light"
          ? "light"
          : document.documentElement.classList.contains("dark") ||
              localStorage.getItem("theme") === "dark"
            ? "dark"
            : "light";
    const newTheme = current === "dark" ? "light" : "dark";

    // 1. Update next-themes (handles DOM class + colorScheme)
    setTheme(newTheme);

    // 2. Sync all storage keys immediately
    localStorage.setItem("theme", newTheme);
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
