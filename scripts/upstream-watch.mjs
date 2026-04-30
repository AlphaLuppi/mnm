#!/usr/bin/env node
/**
 * upstream-watch.mjs
 *
 * Audits paperclipai/paperclip releases since the last MnM upstream-watch
 * audit and produces a triage skeleton for review.
 *
 * Process (mirrors `docs/superpowers/upstream-watch-process.md`):
 *
 *   1. `git fetch upstream --prune --tags` to sync remote refs/tags.
 *   2. Parse `docs/superpowers/upstream-watch.md` to find the last
 *      "Dernier audit complet" date.
 *   3. `gh api repos/paperclipai/paperclip/releases` to list releases
 *      published since that date.
 *   4. For each new release, extract highlights/PRs from the body and
 *      build an initial triage skeleton (PR number, subject, default
 *      verdict = "TODO triage").
 *   5. Output:
 *        --mode=patch      => markdown patch to append to upstream-watch.md
 *                            (default; printed to stdout).
 *        --mode=plan       => write a new plan file
 *                            `docs/superpowers/plans/YYYY-MM-DD-upstream-watch-batch.md`
 *                            and print the path to stdout.
 *        --mode=json       => raw JSON for tooling.
 *
 * Flags:
 *   --since=YYYY-MM-DD    override the "last audit" date (debug / replay).
 *   --dry-run             skip `git fetch upstream` (offline mode).
 *   --no-gh               skip `gh api` and read releases from a fixture
 *                          file (`scripts/upstream-watch.fixture.json`)
 *                          if present — useful for tests / CI offline.
 *   --output=FILE         write to FILE instead of stdout (patch/plan only).
 *   --help                print this help.
 *
 * The script is intentionally read-only against the repo: it never
 * modifies upstream-watch.md or commits anything. It produces a patch
 * the human (or a follow-up agent) reviews and applies.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();

// ---------- arg parsing ----------

const args = process.argv.slice(2);
const opts = {
  mode: "patch", // patch | plan | json
  since: null,
  dryRun: false,
  noGh: false,
  output: null,
  help: false,
};

for (const arg of args) {
  if (arg === "--help" || arg === "-h") opts.help = true;
  else if (arg === "--dry-run") opts.dryRun = true;
  else if (arg === "--no-gh") opts.noGh = true;
  else if (arg.startsWith("--mode=")) opts.mode = arg.slice("--mode=".length);
  else if (arg.startsWith("--since=")) opts.since = arg.slice("--since=".length);
  else if (arg.startsWith("--output=")) opts.output = arg.slice("--output=".length);
  else {
    console.error(`Unknown flag: ${arg}`);
    process.exit(2);
  }
}

if (opts.help) {
  // Print top doc-comment without the leading slash-star markers.
  const self = readFileSync(fileURLToPath(import.meta.url), "utf8");
  const m = self.match(/\/\*\*([\s\S]*?)\*\//);
  if (m) {
    console.log(
      m[1]
        .split("\n")
        .map((l) => l.replace(/^\s*\*\s?/, ""))
        .join("\n")
        .trim(),
    );
  }
  process.exit(0);
}

if (!["patch", "plan", "json"].includes(opts.mode)) {
  console.error(`Invalid --mode=${opts.mode} (expected patch|plan|json)`);
  process.exit(2);
}

// ---------- exports for tests ----------

/**
 * Parse the date of the last completed audit from upstream-watch.md.
 * Looks for a row matching `| Dernier audit complet | **YYYY-MM-DD** ...`.
 * Returns ISO string `YYYY-MM-DD` or null if not found.
 */
export function parseLastAuditDate(markdown) {
  if (typeof markdown !== "string") return null;
  // Permissive regex: allows extra whitespace, optional bold markers.
  const re = /\|\s*Dernier audit complet\s*\|[^|]*?(\d{4}-\d{2}-\d{2})/i;
  const m = markdown.match(re);
  return m ? m[1] : null;
}

/**
 * Extract PR references (#NNNN) from a markdown release body.
 * Deduplicates and returns sorted ascending.
 */
export function extractPrNumbers(body) {
  if (typeof body !== "string") return [];
  const seen = new Set();
  const re = /#(\d{2,6})\b/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const n = Number.parseInt(m[1], 10);
    if (Number.isFinite(n) && n > 0) seen.add(n);
  }
  return [...seen].sort((a, b) => a - b);
}

/**
 * Filter releases published strictly after `sinceIso` (YYYY-MM-DD).
 * If `sinceIso` is null, returns every release.
 */
export function filterReleasesSince(releases, sinceIso) {
  if (!Array.isArray(releases)) return [];
  if (!sinceIso) return releases.slice();
  // We compare on date prefix only; published_at is "YYYY-MM-DDT...Z".
  return releases.filter((r) => {
    const pub = typeof r.published_at === "string" ? r.published_at.slice(0, 10) : "";
    return pub > sinceIso;
  });
}

/**
 * Build a single-release triage row table and section heading.
 */
export function renderRelease(release) {
  const tag = release.tag_name ?? "untagged";
  const pubDate = (release.published_at ?? "").slice(0, 10) || "unknown";
  const prs = extractPrNumbers(release.body ?? "");
  const lines = [];
  lines.push(`### Release \`${tag}\` — published ${pubDate}`);
  lines.push("");
  if (release.html_url) {
    lines.push(`Source: ${release.html_url}`);
    lines.push("");
  }
  if (prs.length === 0) {
    lines.push("_No PR references found in release body — manual triage required._");
    lines.push("");
    return lines.join("\n");
  }
  lines.push("| PR | Subject (extract) | Verdict |");
  lines.push("|---|---|---|");
  for (const pr of prs) {
    const blurb = extractPrBlurb(release.body ?? "", pr);
    const safeBlurb = sanitizeMarkdownCell(blurb || "_(no subject extracted)_");
    lines.push(
      `| [#${pr}](https://github.com/paperclipai/paperclip/pull/${pr}) | ${safeBlurb} | TODO triage |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * Best-effort: pick the line containing the PR reference and return a
 * short subject. Strategy:
 *   1. Strip leading list markers and the trailing `... by @user in #NNNN`
 *      pattern that GitHub's auto-generated release notes use.
 *   2. Otherwise, drop the `#NNNN` token in place and return the line.
 *   3. Cap at 120 chars.
 */
export function extractPrBlurb(body, prNumber) {
  if (typeof body !== "string") return "";
  const lines = body.split(/\r?\n/);
  const re = new RegExp(`#${prNumber}\\b`);
  for (const line of lines) {
    if (re.test(line)) {
      let blurb = line.replace(/^[\s\-*•>]+/, "").trim();
      // GitHub auto-generated release notes often look like:
      //   "feat(security): bla bla by @alice in #4900"
      // Drop the trailing " by @user in #NNNN" suffix when present.
      blurb = blurb.replace(/\s*by\s+@[\w-]+\s+in\s+#\d+\s*$/i, "");
      // Otherwise just drop the bare #NNNN marker.
      blurb = blurb.replace(new RegExp(`\\s*#${prNumber}\\b`), "").trim();
      if (blurb.length > 120) blurb = blurb.slice(0, 117) + "...";
      return blurb;
    }
  }
  return "";
}

/**
 * Replace pipes & newlines in a string so it stays inside one md table cell.
 */
export function sanitizeMarkdownCell(s) {
  return String(s).replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}

/**
 * Render a full markdown patch for upstream-watch.md.
 */
export function renderPatch({ todayIso, releases, lastAuditDate }) {
  const tagRange =
    releases.length === 0
      ? "(no new releases)"
      : releases.length === 1
        ? releases[0].tag_name
        : `${releases.at(-1)?.tag_name ?? "?"} -> ${releases[0]?.tag_name ?? "?"}`;
  const out = [];
  out.push(`## Audit ${todayIso} — ${tagRange}`);
  out.push("");
  out.push(
    `_Generated by \`scripts/upstream-watch.mjs\`. Last audit on file: ${lastAuditDate ?? "unknown"}._`,
  );
  out.push("");
  if (releases.length === 0) {
    out.push("No new upstream releases since the last audit. Nothing to triage.");
    out.push("");
    return out.join("\n");
  }
  // Releases come back from gh in published-desc order — render newest first.
  for (const r of releases) {
    out.push(renderRelease(r));
  }
  out.push(
    "_All rows above need a verdict (port / skip / re-implement / pattern-steal / defer) before this section is merged into the audit table proper._",
  );
  out.push("");
  return out.join("\n");
}

/**
 * Build the contents of a fresh batch plan.
 */
export function renderPlan({ todayIso, releases, lastAuditDate }) {
  const out = [];
  out.push(`# Plan — Upstream-watch batch ${todayIso}`);
  out.push("");
  out.push(`> **Statut** : draft ${todayIso}`);
  out.push(`> **Branche de travail** : \`feat/upstream-watch-${todayIso}\``);
  out.push(`> **Last audit on file** : ${lastAuditDate ?? "unknown"}`);
  out.push(`> **Source** : auto-generated by \`scripts/upstream-watch.mjs\``);
  out.push("");
  out.push("## Releases à trier");
  out.push("");
  if (releases.length === 0) {
    out.push("Aucune nouvelle release upstream depuis le dernier audit.");
    out.push("");
  } else {
    for (const r of releases) {
      out.push(renderRelease(r));
    }
  }
  out.push("## Étapes");
  out.push("");
  out.push("1. Pour chaque PR du tableau, lire le diff + commentaire upstream.");
  out.push("2. Décider du verdict : port / skip / re-implement / pattern-steal / defer.");
  out.push(
    "3. Si port : créer un plan dédié (ou rattacher à un plan existant `docs/superpowers/plans/`).",
  );
  out.push(
    "4. Mettre à jour `docs/superpowers/upstream-watch.md` avec les verdicts et la date d'audit.",
  );
  out.push("5. Push une PR draft pour validation Tom avant tout cherry-pick.");
  out.push("");
  out.push("## Acceptance");
  out.push("");
  out.push("- [ ] Tous les verdicts renseignés dans `upstream-watch.md`.");
  out.push("- [ ] Sécu CRITICAL / HIGH ouverts en issues séparées avec ETA `<= 7j`.");
  out.push(
    "- [ ] Patterns alignés roadmap MnM listés dans la section Phase 5 du plan paperclip-upstream-merge.",
  );
  out.push("");
  return out.join("\n");
}

// ---------- runtime ----------

function fetchUpstream() {
  if (opts.dryRun) {
    console.error("[dry-run] skipping `git fetch upstream`");
    return;
  }
  try {
    execFileSync("git", ["fetch", "upstream", "--prune", "--tags"], {
      cwd: repoRoot,
      stdio: ["ignore", "ignore", "pipe"],
    });
  } catch (err) {
    console.error("warning: `git fetch upstream` failed — continuing with cached refs.");
    if (err && typeof err === "object" && "stderr" in err) {
      const s = err.stderr?.toString?.();
      if (s) console.error(s.trim().split("\n").slice(-3).join("\n"));
    }
  }
}

function loadReleases() {
  // Offline / fixture path for tests.
  if (opts.noGh) {
    const fixturePath = resolve(__dirname, "upstream-watch.fixture.json");
    if (existsSync(fixturePath)) {
      const raw = readFileSync(fixturePath, "utf8");
      return JSON.parse(raw);
    }
    return [];
  }
  try {
    const out = execFileSync(
      "gh",
      [
        "api",
        "-H",
        "Accept: application/vnd.github+json",
        "repos/paperclipai/paperclip/releases?per_page=20",
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    return JSON.parse(out);
  } catch (err) {
    console.error("error: `gh api` failed.");
    if (err && typeof err === "object" && "stderr" in err) {
      const s = err.stderr?.toString?.();
      if (s) console.error(s.trim().split("\n").slice(-5).join("\n"));
    }
    return null;
  }
}

function loadUpstreamWatchMd() {
  const p = resolve(repoRoot, "docs/superpowers/upstream-watch.md");
  if (!existsSync(p)) return "";
  return readFileSync(p, "utf8");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function writeFile(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

async function main() {
  fetchUpstream();
  const md = loadUpstreamWatchMd();
  const lastAudit = opts.since || parseLastAuditDate(md);
  const releases = loadReleases();
  if (releases === null) {
    process.exit(1);
  }
  const filtered = filterReleasesSince(releases, lastAudit);
  const today = todayIso();

  if (opts.mode === "json") {
    const payload = JSON.stringify(
      {
        lastAuditDate: lastAudit,
        today,
        totalReleasesFetched: releases.length,
        newReleases: filtered.length,
        releases: filtered.map((r) => ({
          tag_name: r.tag_name,
          published_at: r.published_at,
          html_url: r.html_url,
          prs: extractPrNumbers(r.body ?? ""),
        })),
      },
      null,
      2,
    );
    if (opts.output) writeFile(resolve(repoRoot, opts.output), payload + "\n");
    else process.stdout.write(payload + "\n");
    return;
  }

  if (opts.mode === "patch") {
    const patch = renderPatch({ todayIso: today, releases: filtered, lastAuditDate: lastAudit });
    if (opts.output) writeFile(resolve(repoRoot, opts.output), patch);
    else process.stdout.write(patch);
    return;
  }

  if (opts.mode === "plan") {
    const plan = renderPlan({ todayIso: today, releases: filtered, lastAuditDate: lastAudit });
    const planPath =
      opts.output ?? `docs/superpowers/plans/${today}-upstream-watch-batch.md`;
    const abs = resolve(repoRoot, planPath);
    writeFile(abs, plan);
    process.stdout.write(planPath + "\n");
    return;
  }
}

// Only run main() when executed directly (not when imported by tests).
const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((err) => {
    console.error(err?.stack ?? err);
    process.exit(1);
  });
}
