"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname } from "next/navigation";

type NavLoadingContextType = {
  isNavigating: boolean;
  startNavigation: () => void;
};

const NavLoadingContext = createContext<NavLoadingContextType>({
  isNavigating: false,
  startNavigation: () => {},
});

export function NavLoadingProvider({ children }: { children: ReactNode }) {
  const [isNavigating, setIsNavigating] = useState(false);
  const pathname = usePathname();

  // When pathname changes, navigation is complete
  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  // Safety timeout — hide after 8s in case something gets stuck
  useEffect(() => {
    if (!isNavigating) return;
    const timer = setTimeout(() => setIsNavigating(false), 8000);
    return () => clearTimeout(timer);
  }, [isNavigating]);

  const startNavigation = useCallback(() => {
    setIsNavigating(true);
  }, []);

  return (
    <NavLoadingContext.Provider value={{ isNavigating, startNavigation }}>
      {children}

      {/* Full-screen spinner overlay */}
      {isNavigating && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/60 backdrop-blur-sm print:hidden">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground animate-pulse">
              جاري التحميل...
            </p>
          </div>
        </div>
      )}
    </NavLoadingContext.Provider>
  );
}

export function useNavLoading() {
  return useContext(NavLoadingContext);
}
