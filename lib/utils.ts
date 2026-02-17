import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Remove all whitespace from a string (for space-insensitive search) */
export function noSpaces(s: string): string {
  return s.replace(/\s/g, "");
}
