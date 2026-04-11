#!/usr/bin/env bun
/**
 * Parity CLI — renders scripts/parity/data.ts as a readable terminal report.
 *
 * Usage:
 *   bun run parity                  # full report
 *   bun run parity --missing        # only show features done on web but not desktop
 *   bun run parity --todo           # only show features with open todo items
 *   bun run parity --domain=agents  # filter to one domain
 *   bun run parity --json           # raw JSON output
 *
 * Exit codes:
 *   0 — report rendered
 *   1 — bad CLI args
 */

import {
  parityData,
  type Domain,
  type Feature,
  type FeatureStatus,
  type PlatformState,
  type TodoList,
} from "./data";

type Args = {
  missing: boolean;
  todo: boolean;
  json: boolean;
  domain: string | null;
};

function parseArgs(argv: readonly string[]): Args {
  const out: Args = { missing: false, todo: false, json: false, domain: null };
  for (const arg of argv) {
    if (arg === "--missing") out.missing = true;
    else if (arg === "--todo") out.todo = true;
    else if (arg === "--json") out.json = true;
    else if (arg.startsWith("--domain=")) out.domain = arg.slice("--domain=".length);
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }
  return out;
}

function printHelp(): void {
  console.log(`Usage: bun run parity [options]

Options:
  --missing         Show only features where web is done but desktop is not
  --todo            Show only features with open todo items
  --domain=<id>     Filter to a single domain (e.g. --domain=agents)
  --json            Print raw JSON (bypasses all formatting)
  -h, --help        Show this help

Status legend:
  done       Fully implemented & verified
  dev-only   Works in dev, not yet verified in packaged build
  partial    Implemented with known gaps
  missing    Not implemented
  n/a        Not applicable to this platform
`);
}

// -------- ANSI colors (no deps) --------

const ansi = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
} as const;

const isTTY = process.stdout.isTTY;
const color = (c: keyof typeof ansi, s: string): string =>
  isTTY ? `${ansi[c]}${s}${ansi.reset}` : s;

function statusColor(status: FeatureStatus): string {
  const label = status.padEnd(8);
  switch (status) {
    case "done":
      return color("green", `● ${label}`);
    case "dev-only":
      return color("yellow", `◐ ${label}`);
    case "partial":
      return color("yellow", `◐ ${label}`);
    case "missing":
      return color("red", `○ ${label}`);
    case "n/a":
      return color("gray", `─ ${label}`);
  }
}

// -------- Helpers --------

function isDone(state: PlatformState): boolean {
  return state.status === "done" || state.status === "n/a";
}

function isGap(feature: Feature): boolean {
  // Gap = web done but desktop not done (and not n/a on desktop)
  return feature.web.status === "done" && !isDone(feature.desktop);
}

function hasTodo(feature: Feature): boolean {
  const t = feature.todo;
  if (!t) return false;
  return Boolean(
    (t.tests && t.tests.length) ||
      (t.config && t.config.length) ||
      (t.code && t.code.length) ||
      (t.notes && t.notes.length),
  );
}

function filterData(args: Args): Domain[] {
  return parityData.domains
    .filter((d) => !args.domain || d.id === args.domain)
    .map((d) => ({
      ...d,
      features: d.features.filter((f) => {
        if (args.missing && !isGap(f)) return false;
        if (args.todo && !hasTodo(f)) return false;
        return true;
      }),
    }))
    .filter((d) => d.features.length > 0);
}

// -------- Stats --------

interface Stats {
  totalFeatures: number;
  webDone: number;
  desktopDone: number;
  gaps: number;
  openTodos: number;
}

function computeStats(domains: readonly Domain[]): Stats {
  let totalFeatures = 0;
  let webDone = 0;
  let desktopDone = 0;
  let gaps = 0;
  let openTodos = 0;
  for (const d of domains) {
    for (const f of d.features) {
      totalFeatures++;
      if (isDone(f.web)) webDone++;
      if (isDone(f.desktop)) desktopDone++;
      if (isGap(f)) gaps++;
      if (hasTodo(f)) openTodos++;
    }
  }
  return { totalFeatures, webDone, desktopDone, gaps, openTodos };
}

function percent(n: number, total: number): string {
  if (total === 0) return "  0%";
  return `${Math.round((n / total) * 100)}%`.padStart(4);
}

// -------- Renderers --------

function renderHeader(stats: Stats): string {
  const lines: string[] = [];
  lines.push(color("bold", "╔════════════════════════════════════════════════════════════════╗"));
  lines.push(
    color("bold", "║") +
      "         " +
      color("cyan", "MnM Parity Report") +
      color("dim", `  —  ${parityData.generated}`) +
      "                     " +
      color("bold", "║"),
  );
  lines.push(color("bold", "╠════════════════════════════════════════════════════════════════╣"));
  lines.push(
    color("bold", "║") +
      `  Web: ${color("cyan", `v${parityData.webVersion}`).padEnd(20)}` +
      `  Desktop: ${color("cyan", `v${parityData.desktopVersion}`).padEnd(20)}` +
      "   " +
      color("bold", "║"),
  );
  lines.push(
    color("bold", "║") +
      `  Features: ${String(stats.totalFeatures).padEnd(4)}` +
      `  Domains: ${String(parityData.domains.length).padEnd(4)}` +
      `  Gaps: ${color("red", String(stats.gaps)).padEnd(12)}` +
      "         " +
      color("bold", "║"),
  );
  lines.push(
    color("bold", "║") +
      `  Web done:     ${color("green", String(stats.webDone).padStart(3))}  (${percent(stats.webDone, stats.totalFeatures)})` +
      "                                  " +
      color("bold", "║"),
  );
  lines.push(
    color("bold", "║") +
      `  Desktop done: ${color("green", String(stats.desktopDone).padStart(3))}  (${percent(stats.desktopDone, stats.totalFeatures)})` +
      "                                  " +
      color("bold", "║"),
  );
  lines.push(color("bold", "╚════════════════════════════════════════════════════════════════╝"));
  return lines.join("\n");
}

function renderTodo(todo: TodoList): string[] {
  const lines: string[] = [];
  const sections: [keyof TodoList, string][] = [
    ["code", "code"],
    ["config", "config"],
    ["tests", "tests"],
    ["notes", "notes"],
  ];
  for (const [key, label] of sections) {
    const items = todo[key];
    if (!items || items.length === 0) continue;
    for (const item of items) {
      lines.push(color("gray", `       ↳ [${label}] `) + color("dim", item));
    }
  }
  return lines;
}

function renderFeature(f: Feature): string[] {
  const lines: string[] = [];
  const name = f.name.length > 54 ? f.name.slice(0, 51) + "..." : f.name;
  lines.push(
    "  " +
      color("bold", name.padEnd(56)) +
      " web:" +
      statusColor(f.web.status) +
      " desk:" +
      statusColor(f.desktop.status),
  );

  const notes: string[] = [];
  if (f.web.notes) notes.push(`web: ${f.web.notes}`);
  if (f.desktop.notes) notes.push(`desk: ${f.desktop.notes}`);
  for (const n of notes) lines.push(color("gray", "       ") + color("dim", n));

  const blockers = new Set<string>([
    ...(f.web.blockers ?? []),
    ...(f.desktop.blockers ?? []),
  ]);
  if (blockers.size > 0) {
    lines.push(
      color("gray", "       blockers: ") +
        color("magenta", [...blockers].join(", ")),
    );
  }

  if (f.todo) lines.push(...renderTodo(f.todo));
  return lines;
}

function renderDomain(d: Domain): string {
  const out: string[] = [];
  out.push("");
  out.push(color("blue", `● ${d.name.toUpperCase()}`) + color("dim", `  (${d.id})`));
  for (const f of d.features) out.push(...renderFeature(f));
  return out.join("\n");
}

function renderBlockerLegend(domains: readonly Domain[]): string {
  const used = new Set<string>();
  for (const d of domains) {
    for (const f of d.features) {
      for (const b of f.web.blockers ?? []) used.add(b);
      for (const b of f.desktop.blockers ?? []) used.add(b);
    }
  }
  if (used.size === 0) return "";
  const lines: string[] = ["", color("blue", "● BLOCKERS")];
  for (const id of used) {
    const desc = parityData.sharedBlockers[id];
    if (!desc) continue;
    lines.push(
      "  " + color("magenta", id) + color("dim", ` — ${desc}`),
    );
  }
  return lines.join("\n");
}

// -------- Main --------

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const filtered = filterData(args);

  if (args.json) {
    console.log(JSON.stringify({ ...parityData, domains: filtered }, null, 2));
    return;
  }

  const stats = computeStats(filtered);
  console.log(renderHeader(stats));

  if (filtered.length === 0) {
    console.log("\n" + color("gray", "  (no features match the current filter)"));
    return;
  }

  for (const d of filtered) console.log(renderDomain(d));
  const legend = renderBlockerLegend(filtered);
  if (legend) console.log(legend);
  console.log("");
}

main();
