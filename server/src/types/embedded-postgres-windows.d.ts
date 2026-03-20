// Type stub for @embedded-postgres/windows-x64 — only available on Windows.
// The dynamic import in index.ts is guarded by process.platform === "win32"
// and wrapped in try/catch, so this stub is only needed to satisfy tsc on Linux.
declare module "@embedded-postgres/windows-x64" {
  export const pg_ctl: string;
}
