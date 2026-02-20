"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { GitStatusBar } from "@/components/layout/git-status-bar";
import { SpecChangeBadge } from "@/components/layout/spec-change-badge";
import { HelpMenu } from "@/components/layout/help-menu";

interface AppHeaderProps {
  title?: string;
}

export function AppHeader({ title = "MnM" }: AppHeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-3">
        <GitStatusBar />
        <Separator orientation="vertical" className="h-4" />
        <SpecChangeBadge />
        <Separator orientation="vertical" className="h-4" />
        <HelpMenu />
      </div>
    </header>
  );
}
