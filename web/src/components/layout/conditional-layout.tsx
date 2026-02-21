"use client";

import { usePathname } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { ActivityBar } from "@/components/layout/activity-bar";
import { SpecSearch } from "@/components/specs/spec-search";
import { ShortcutProvider } from "@/components/shared/shortcut-provider";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { ChatProvider, ChatPanel, useChat } from "@/components/chat";
import { ProjectProvider } from "@/contexts/project-context";
import { useServerEvents } from "@/hooks/use-server-events";

const MINIMAL_LAYOUT_PATHS = ["/onboarding"];

function FullLayout({ children }: { children: React.ReactNode }) {
  useServerEvents();
  const { toggleChat } = useChat();

  return (
    <SidebarProvider>
      <ShortcutProvider>
        <div className="flex h-screen overflow-hidden w-full">
          <AppSidebar />
          <SidebarInset className="flex flex-col min-w-0 flex-1">
            <AppHeader />
            <main className="flex-1 overflow-auto p-4">
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>
            <ActivityBar onToggleChat={toggleChat} />
          </SidebarInset>
          <ChatPanel />
        </div>
        <SpecSearch />
      </ShortcutProvider>
    </SidebarProvider>
  );
}

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMinimalLayout = MINIMAL_LAYOUT_PATHS.some((p) =>
    pathname.startsWith(p)
  );

  if (isMinimalLayout) {
    return (
      <ProjectProvider>
        <ChatProvider>
          <ErrorBoundary>{children}</ErrorBoundary>
        </ChatProvider>
      </ProjectProvider>
    );
  }

  return (
    <ProjectProvider>
      <ChatProvider>
        <FullLayout>{children}</FullLayout>
      </ChatProvider>
    </ProjectProvider>
  );
}
