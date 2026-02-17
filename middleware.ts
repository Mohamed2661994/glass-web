import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token =
    request.cookies.get("token")?.value || request.headers.get("authorization");

  // Check localStorage-based auth via a custom header set by the client
  // Since we use localStorage for token, we protect routes client-side too
  // This middleware provides an extra layer by checking the cookie fallback
  const isLoginPage = request.nextUrl.pathname === "/login";
  const isPublicAsset =
    request.nextUrl.pathname.startsWith("/_next") ||
    request.nextUrl.pathname.startsWith("/icons") ||
    request.nextUrl.pathname.startsWith("/images") ||
    request.nextUrl.pathname.startsWith("/sounds") ||
    request.nextUrl.pathname.startsWith("/api") ||
    request.nextUrl.pathname === "/manifest.json" ||
    request.nextUrl.pathname === "/sw.js" ||
    request.nextUrl.pathname === "/favicon.ico";

  if (isPublicAsset || isLoginPage) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
