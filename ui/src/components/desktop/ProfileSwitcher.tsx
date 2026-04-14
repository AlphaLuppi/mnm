/**
 * Slack-style connection-profile switcher for the desktop title bar.
 *
 * Renders the active profile as a compact pill (colored initial + name)
 * and a dropdown listing every known profile plus an "Add instance"
 * action. Switching between profiles is destructive enough (auth token
 * tied to a specific backend, CSP pinned to its origin) that we reload
 * the webview instead of hot-swapping — the boot sequence in `main.tsx`
 * then rebuilds the CSP and re-hydrates the session token from Keychain
 * for the freshly active profile.
 *
 * Only visible in packaged Tauri builds. In web and Tauri dev the gate
 * in `DesktopTitleBar` prevents this component from ever mounting.
 */
import { useEffect, useState, type ReactElement } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getCachedActiveProfile,
  listProfiles,
  setActiveProfile,
} from "@/lib/profile-client";
import { profileAccent, profileInitial } from "@/lib/profile-branding";
import type { Profile } from "@/lib/profile-types";
import { AddProfileDialog } from "./AddProfileDialog";

interface ProfileAvatarProps {
  profile: Profile;
  size?: "sm" | "md";
}

function ProfileAvatar({
  profile,
  size = "md",
}: ProfileAvatarProps): ReactElement {
  const accent = profileAccent(profile.id);
  const initial = profileInitial(profile.displayName);
  const dimension = size === "sm" ? "h-5 w-5 text-[10px]" : "h-6 w-6 text-xs";
  return (
    <span
      aria-hidden="true"
      className={`inline-flex ${dimension} shrink-0 items-center justify-center rounded font-semibold`}
      style={{
        backgroundColor: accent.background,
        color: accent.foreground,
        boxShadow: `inset 0 0 0 1px ${accent.ring}`,
      }}
    >
      {initial}
    </span>
  );
}

export function ProfileSwitcher(): ReactElement | null {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [active, setActive] = useState<Profile | null>(
    getCachedActiveProfile(),
  );
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [addOpen, setAddOpen] = useState<boolean>(false);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    // Populate the list lazily the first time the menu is opened. We keep
    // the cached active profile synchronously from getCachedActiveProfile()
    // so the trigger pill can render immediately without a loading state.
    if (!menuOpen) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await listProfiles();
        if (!cancelled) setProfiles(list);
      } catch {
        if (!cancelled) setProfiles([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [menuOpen]);

  // Without an active profile the switcher hides entirely: NoProfileGate
  // is handling the first-run flow and a half-populated pill would be
  // misleading chrome.
  if (active === null) return null;

  async function handleSwitch(id: string): Promise<void> {
    if (id === active?.id) {
      setMenuOpen(false);
      return;
    }
    setSwitching(id);
    try {
      await setActiveProfile(id);
      // CSP is pinned to the previous profile's origin — a reload forces
      // the boot sequence to rebuild it against the new backend before
      // any network call happens.
      window.location.reload();
    } catch {
      setSwitching(null);
    }
  }

  function handleAdded(created: Profile): void {
    // Optimistically splice the new profile into the list so subsequent
    // menu opens see it without a round-trip.
    setProfiles((current) => [...current, created]);
    setActive(created);
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium text-foreground/90 transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          data-testid="desktop-profile-switcher-trigger"
          data-tauri-drag-region="false"
          aria-label={`Connected to ${active.displayName}. Open instance switcher.`}
        >
          <ProfileAvatar profile={active} size="sm" />
          <span className="max-w-[12rem] truncate">{active.displayName}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className="w-[260px]"
          data-testid="desktop-profile-switcher-menu"
        >
          <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Instances
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {profiles.length === 0 ? (
            // The cached active profile still needs to render as an entry
            // while the async list is in flight so the user can see what
            // they are currently connected to without a flash of emptiness.
            <ProfileRow
              profile={active}
              isActive={true}
              isSwitching={false}
              onSelect={() => void handleSwitch(active.id)}
            />
          ) : (
            profiles.map((profile) => (
              <ProfileRow
                key={profile.id}
                profile={profile}
                isActive={profile.id === active.id}
                isSwitching={switching === profile.id}
                onSelect={() => void handleSwitch(profile.id)}
              />
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setMenuOpen(false);
              setAddOpen(true);
            }}
            data-testid="desktop-profile-switcher-add"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add instance…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AddProfileDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={handleAdded}
      />
    </>
  );
}

interface ProfileRowProps {
  profile: Profile;
  isActive: boolean;
  isSwitching: boolean;
  onSelect: () => void;
}

function ProfileRow({
  profile,
  isActive,
  isSwitching,
  onSelect,
}: ProfileRowProps): ReactElement {
  return (
    <DropdownMenuItem
      onSelect={(event) => {
        event.preventDefault();
        onSelect();
      }}
      className="flex items-start gap-2 py-2"
      data-testid={
        isActive
          ? "desktop-profile-switcher-item-active"
          : `desktop-profile-switcher-item-${profile.id}`
      }
      data-profile-id={profile.id}
      aria-disabled={isSwitching}
    >
      <ProfileAvatar profile={profile} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{profile.displayName}</div>
        <div className="truncate text-[11px] text-muted-foreground">
          {profile.apiBaseUrl}
        </div>
      </div>
      {isActive && (
        <Check
          className="mt-1 h-3.5 w-3.5 shrink-0 text-foreground/80"
          aria-label="Active instance"
        />
      )}
    </DropdownMenuItem>
  );
}
