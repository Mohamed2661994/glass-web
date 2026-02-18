import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Remove all whitespace from a string (for space-insensitive search) */
export function noSpaces(s: string): string {
  return s.replace(/\s/g, "");
}

/**
 * Multi-word search: splits the query by spaces and returns true
 * if EVERY word matches at least one of the provided fields.
 * e.g. "زجاجة وردة" → item must contain "زجاجة" AND "وردة" in any field.
 * Single word behaves the same as before.
 */
export function multiWordMatch(
  query: string,
  ...fields: (string | undefined | null)[]
): boolean {
  const words = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => noSpaces(w).toLowerCase());

  if (words.length === 0) return true;

  // Concatenate all fields into one searchable string
  const combined = fields
    .map((f) => noSpaces(f || "").toLowerCase())
    .join(" ");

  // Every word must appear in at least one field
  return words.some((word) => combined.includes(word));
}
