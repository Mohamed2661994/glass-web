import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { AuthProvider } from "./context/auth-context";

export const metadata: Metadata = {
  title: "Glass System",
  description: "نظام إدارة المخزون والفواتير",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Glass",
  },
};

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link
          rel="icon"
          type="image/png"
          href="/icons/icon-32.png"
          sizes="32x32"
        />
        <link
          rel="icon"
          type="image/png"
          href="/icons/icon-16.png"
          sizes="16x16"
        />
        <link rel="apple-touch-icon" href="/icons/icon-180.png" />
        <link rel="apple-touch-startup-image" href="/images/splash.png" />
      </head>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          disableTransitionOnChange
        >
          <AuthProvider>
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(reg) {
                      reg.addEventListener('updatefound', function() {
                        var newWorker = reg.installing;
                        if (newWorker) {
                          newWorker.addEventListener('statechange', function() {
                            if (newWorker.state === 'activated') {
                              console.log('[SW] New version activated');
                            }
                          });
                        }
                      });
                    })
                    .catch(function(err) {
                      console.warn('[SW] Registration failed:', err);
                    });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
