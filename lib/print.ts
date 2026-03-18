export const isWindowsChromiumUserAgent = (userAgent?: string | null) => {
  const value = String(userAgent || "");
  if (!value) return false;

  return (
    /Windows/i.test(value) &&
    /(Edg|Chrome)/i.test(value) &&
    !/(OPR|Opera|YaBrowser|SamsungBrowser)/i.test(value)
  );
};

export const shouldUseBrowserOrientationSelection = () => {
  if (typeof navigator === "undefined") return false;
  return isWindowsChromiumUserAgent(navigator.userAgent);
};

export const getPrintPageRule = ({
  paperSize,
  margin,
  orientation,
  widthMM,
  heightMM,
  allowBrowserOrientationSelection = false,
}: {
  paperSize: string;
  margin: string;
  orientation?: "portrait" | "landscape";
  widthMM?: number;
  heightMM?: number;
  allowBrowserOrientationSelection?: boolean;
}) => {
  if (allowBrowserOrientationSelection) {
    return `@page { size: ${paperSize}; margin: ${margin}; }`;
  }

  if (typeof widthMM === "number" && typeof heightMM === "number") {
    return `@page { size:${widthMM}mm ${heightMM}mm; margin:${margin}; }`;
  }

  if (orientation) {
    return `@page { size: ${paperSize} ${orientation}; margin: ${margin}; }`;
  }

  return `@page { size: ${paperSize}; margin: ${margin}; }`;
};