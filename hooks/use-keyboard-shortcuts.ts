"use client";

import { useEffect } from "react";

interface ShortcutCallbacks {
  onNewInvoice?: () => void;
  onSave?: () => void;
  onPrint?: () => void;
  onSearch?: () => void;
}

/**
 * Hook to register global keyboard shortcuts
 * Ctrl+N = New Invoice
 * Ctrl+S = Save
 * Ctrl+P = Print
 * Ctrl+F = Search
 */
export function useKeyboardShortcuts(callbacks: ShortcutCallbacks) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only proceed if Ctrl/Cmd is pressed
      if (!e.ctrlKey && !e.metaKey) return;

      // Prevent default only for our shortcuts
      switch (e.key?.toLowerCase()) {
        case "n": // Ctrl+N = New
          e.preventDefault();
          callbacks.onNewInvoice?.();
          break;
        case "s": // Ctrl+S = Save
          e.preventDefault();
          callbacks.onSave?.();
          break;
        case "p": // Ctrl+P = Print (Note: browser might intercept this)
          e.preventDefault();
          callbacks.onPrint?.();
          break;
        case "f": // Ctrl+F = Search (Note: browser might intercept this)
          e.preventDefault();
          callbacks.onSearch?.();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [callbacks]);
}

/**
 * Show keyboard shortcuts help dialog
 */
export const KEYBOARD_SHORTCUTS = [
  { keys: "Ctrl+N", action: "فاتورة جديدة (New Invoice)" },
  { keys: "Ctrl+S", action: "حفظ (Save)" },
  { keys: "Ctrl+P", action: "طباعة (Print)" },
  { keys: "Ctrl+F", action: "بحث (Search)" },
];
