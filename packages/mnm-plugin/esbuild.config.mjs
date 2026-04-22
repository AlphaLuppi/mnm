// Build config for the MnM Claude Code plugin binary.
//
// Output: ../../plugins/mnm/bin/mnm-session-start (ESM bundle with shebang).
// This file is checked into git so users installing the plugin get a
// ready-to-run binary without needing Node toolchain bootstrapping beyond
// what Claude Code already requires.
export default {
  entryPoints: ["src/session-start.ts"],
  outfile: "../../plugins/mnm/bin/mnm-session-start",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  // Shebang so the hook binary is directly executable. Claude Code invokes
  // it with the working directory = session cwd; we rely only on
  // CLAUDE_PLUGIN_ROOT / CLAUDE_PLUGIN_DATA env vars so cwd does not matter.
  banner: { js: "#!/usr/bin/env node" },
  // Bundle everything — the binary must not depend on node_modules at
  // runtime, because the plugin cache directory ($CLAUDE_PLUGIN_ROOT) has
  // no npm install step.
  packages: "bundle",
  minify: false,
  sourcemap: false,
};
