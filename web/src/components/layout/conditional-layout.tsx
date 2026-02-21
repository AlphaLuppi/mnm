"use client";

import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { StatusBar } from "@/components/layout/status-bar";
import { SpecSearch } from "@/components/specs/spec-search";
import { ShortcutProvider } from "@/components/shared/shortcut-provider";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { ClaudeProvider } from "@/components/claude";
import { ClaudeFab } from "@/components/claude/claude-fab";

const MINIMAL_LAYOUT_PATHS = ["/onboarding"];

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMinimalLayout = MINIMAL_LAYOUT_PATHS.some((p) =>
    pathname.startsWith(p)
  );

  if (isMinimalLayout) {
    return (
      <ClaudeProvider>
        <ErrorBoundary>{children}</ErrorBoundary>
      </ClaudeProvider>
    );
  }

  return (
    <ClaudeProvider>
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
          <ClaudeFab />
        </ShortcutProvider>
      </SidebarProvider>
    </ClaudeProvider>
  );
}
