import React from "react";

/**
 * Highlights occurrences of `query` within `text`.
 * Returns a React node with <mark> tags around matched parts.
 * If query is empty, returns the text as-is.
 * Ignores spaces in both query and text when matching.
 */
export function highlightText(
  text: string | number | null | undefined,
  query: string,
): React.ReactNode {
  if (!text && text !== 0) return "-";
  const str = String(text);
  if (!query || !query.trim()) return str;

  const q = query.replace(/\s/g, "").toLowerCase();
  if (!q) return str;

  // Build a regex that matches the query chars with optional \s* between them
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = escaped.split("").join("\\s*");
  const re = new RegExp(pattern, "i");
  const m = re.exec(str);

  if (!m) return str;

  const before = str.slice(0, m.index);
  const match = str.slice(m.index, m.index + m[0].length);
  const after = str.slice(m.index + m[0].length);

  return (
    <>
      {before}
      <mark className="bg-yellow-200 dark:bg-yellow-700 rounded-sm px-0.5">
        {match}
      </mark>
      {after}
    </>
  );
}
