import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { StatusBar } from "@/components/layout/status-bar";
import { SpecSearch } from "@/components/specs/spec-search";
import { Toaster } from "@/components/ui/sonner";
import { ShortcutProvider } from "@/components/shared/shortcut-provider";
import { ErrorBoundary } from "@/components/shared/error-boundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MnM - Product-First ADE",
  description:
    "Agent orchestration, drift detection, and spec-as-interface for AI-driven development",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <TooltipProvider>
            <SidebarProvider>
              <ShortcutProvider>
                <AppSidebar />
                <SidebarInset>
                  <AppHeader />
                  <main className="flex-1 overflow-auto p-4">
                    <ErrorBoundary>{children}</ErrorBoundary>
                  </main>
                  <StatusBar />
                </SidebarInset>
                <SpecSearch />
              </ShortcutProvider>
            </SidebarProvider>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
