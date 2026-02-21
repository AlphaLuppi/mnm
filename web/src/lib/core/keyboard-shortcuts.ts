export interface ShortcutDef {
  key: string;
  meta?: boolean;
  shift?: boolean;
  label: string;
  category: string;
  action: string;
}

export const SHORTCUTS: ShortcutDef[] = [
  // Navigation
  { key: "k", meta: true, label: "Search / Command Palette", category: "Navigation", action: "open-search" },
  { key: "1", meta: true, label: "Go to Specs", category: "Navigation", action: "nav-specs" },
  { key: "2", meta: true, label: "Go to Agents", category: "Navigation", action: "nav-agents" },
  { key: "3", meta: true, label: "Go to Drift", category: "Navigation", action: "nav-drift" },
  { key: "4", meta: true, label: "Go to Progress", category: "Navigation", action: "nav-progress" },
  { key: "b", meta: true, label: "Toggle Sidebar", category: "Navigation", action: "toggle-sidebar" },
  { key: ",", meta: true, label: "Settings", category: "Navigation", action: "nav-settings" },

  // Terminal
  { key: "`", meta: true, label: "Toggle Claude Terminal", category: "Terminal", action: "toggle-terminal" },
  { key: "j", meta: true, label: "Open Claude Terminal", category: "Terminal", action: "open-terminal" },

  // Agent
  { key: "l", meta: true, shift: true, label: "Launch Agent", category: "Agent", action: "launch-agent" },
  { key: "t", meta: true, shift: true, label: "Terminate Agent", category: "Agent", action: "terminate-agent" },

  // Help
  { key: "/", meta: true, label: "Keyboard Shortcuts", category: "Help", action: "show-shortcuts" },
  { key: "?", meta: true, label: "Help Menu", category: "Help", action: "show-help" },
];

export function matchesShortcut(e: KeyboardEvent, def: ShortcutDef): boolean {
  if (def.meta && !(e.metaKey || e.ctrlKey)) return false;
  if (def.shift && !e.shiftKey) return false;
  if (!def.shift && e.shiftKey && def.meta) return false;
  return e.key.toLowerCase() === def.key.toLowerCase();
}

export function formatShortcut(def: ShortcutDef): string {
  const parts: string[] = [];
  if (def.meta) parts.push(typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent) ? "\u2318" : "Ctrl");
  if (def.shift) parts.push("\u21E7");
  parts.push(def.key.toUpperCase());
  return parts.join("+");
}
