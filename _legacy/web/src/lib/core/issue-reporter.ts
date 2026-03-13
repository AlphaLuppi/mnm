const REPO_URL = "https://github.com/nicobailey/mnm";

export function getReportUrl(error?: { code?: string; message?: string }): string {
  const title = error?.code
    ? `Bug: ${error.code} - ${error.message ?? "Unexpected error"}`
    : "Bug Report";

  const body = [
    "## Description",
    "",
    "<!-- Describe what happened -->",
    "",
    "## Steps to Reproduce",
    "",
    "1. ",
    "2. ",
    "3. ",
    "",
    "## Error Details",
    "",
    `- **Code**: ${error?.code ?? "N/A"}`,
    `- **Message**: ${error?.message ?? "N/A"}`,
    `- **MnM Version**: ${process.env.npm_package_version ?? "unknown"}`,
    `- **OS**: ${typeof navigator !== "undefined" ? navigator.userAgent : "server"}`,
    "",
    "## Expected Behavior",
    "",
    "<!-- What should have happened -->",
  ].join("\n");

  const params = new URLSearchParams({ title, body });
  return `${REPO_URL}/issues/new?${params.toString()}`;
}
