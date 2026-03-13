"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  HelpCircle,
  BookOpen,
  Keyboard,
  ExternalLink,
  Info,
  Rocket,
} from "lucide-react";
import { useShortcutDialog } from "@/components/shared/shortcut-provider";
import { AboutDialog } from "@/components/help/about-dialog";
import { QuickStartGuide } from "@/components/help/quick-start-guide";

export function HelpMenu() {
  const { setShowShortcuts } = useShortcutDialog();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [quickStartOpen, setQuickStartOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Help menu">
            <HelpCircle className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setQuickStartOpen(true)}>
            <Rocket className="mr-2 h-4 w-4" />
            Quick Start Guide
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowShortcuts(true)}>
            <Keyboard className="mr-2 h-4 w-4" />
            Keyboard Shortcuts
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href="https://github.com/nicobailey/mnm#readme"
              target="_blank"
              rel="noopener noreferrer"
            >
              <BookOpen className="mr-2 h-4 w-4" />
              Documentation
              <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a
              href="https://github.com/nicobailey/mnm/issues/new"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Report Issue
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setAboutOpen(true)}>
            <Info className="mr-2 h-4 w-4" />
            About MnM
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      <QuickStartGuide open={quickStartOpen} onOpenChange={setQuickStartOpen} />
    </>
  );
}
