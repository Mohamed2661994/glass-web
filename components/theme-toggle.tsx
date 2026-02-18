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
  const { setThemePref } = useUserPreferences();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggle = () => {
    const newTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    // حفظ الثيم لليوزر (localStorage + backend)
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
