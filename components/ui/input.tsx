import * as React from "react";

import { cn, toEnDigits } from "@/lib/utils";

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

function Input({
  className,
  type,
  onChange,
  ...props
}: React.ComponentProps<"input">) {
  const isNumeric = type === "number";
  const isMobile = useIsMobile();

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isNumeric) {
        // Normalize Arabic-Indic (٠-٩) and extended (۰-۹) digits to Western (0-9)
        const raw = e.target.value;
        const normalized = toEnDigits(raw);
        if (raw !== normalized) {
          e.target.value = normalized;
        }
      }
      onChange?.(e);
    },
    [isNumeric, onChange],
  );

  // On mobile: use type="text" + inputMode="decimal" so Arabic-Indic digits are accepted
  // On desktop: keep native type="number" with spinners and validation
  const resolvedType = isNumeric && isMobile ? "text" : type;
  const resolvedInputMode = isNumeric && isMobile ? "decimal" : undefined;

  return (
    <input
      type={resolvedType}
      inputMode={resolvedInputMode}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className,
      )}
      onChange={handleChange}
      {...props}
    />
  );
}

export { Input };
