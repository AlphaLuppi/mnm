import { useState } from "react";
import { LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { authApi } from "../api/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function UserMenu() {
  const { user, isAuthenticatedMode } = useCurrentUser();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  if (!isAuthenticatedMode || !user) return null;

  const initial = (user.name?.[0] ?? user.email?.[0] ?? "?").toUpperCase();
  const displayName = user.name || user.email || "User";

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authApi.signOut();
      queryClient.clear();
      window.location.href = "/auth";
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <DropdownMenu>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              data-testid="mu-s06-user-avatar"
              className="flex items-center justify-center w-9 h-9 rounded-full bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors focus:outline-none"
              aria-label="User menu"
            >
              {initial}
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          <p>{displayName}</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        data-testid="mu-s06-user-menu"
        side="right"
        align="end"
        sideOffset={8}
      >
        <DropdownMenuLabel>
          <span data-testid="mu-s06-user-email" className="text-xs text-muted-foreground font-normal">
            {user.email || user.name || "User"}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          data-testid="mu-s06-sign-out-button"
          disabled={signingOut}
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          {signingOut ? "Signing out..." : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
