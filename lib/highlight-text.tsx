import React from "react";

/**
 * Highlights occurrences of `query` within `text`.
 * Supports multi-word queries: each word is highlighted independently.
 * e.g. query="زجاجة وردة" highlights both "زجاجة" and "وردة" wherever they appear.
 * Ignores spaces within each word when matching.
 */
export function highlightText(
  text: string | number | null | undefined,
  query: string,
): React.ReactNode {
  if (!text && text !== 0) return "-";
  const str = String(text);
  if (!query || !query.trim()) return str;

  // Split query into individual words, remove empty entries
  const words = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/\s/g, ""));

  if (words.length === 0) return str;

  // Build a combined regex: each word allows optional spaces between chars
  const wordPatterns = words.map((w) => {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return escaped.split("").join("\\s*");
  });

  const combined = new RegExp(`(${wordPatterns.join("|")})`, "gi");

  // Split string by matches and wrap matched parts in <mark>
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = combined.exec(str)) !== null) {
    if (match.index > lastIndex) {
      parts.push(str.slice(lastIndex, match.index));
    }
    parts.push(
      <mark
        key={key++}
        className="bg-yellow-200 dark:bg-yellow-700 rounded-sm px-0.5"
      >
        {match[0]}
      </mark>,
    );
    lastIndex = combined.lastIndex;

    // Prevent infinite loop on zero-length matches
    if (match[0].length === 0) combined.lastIndex++;
  }

  if (lastIndex < str.length) {
    parts.push(str.slice(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : str;
}
