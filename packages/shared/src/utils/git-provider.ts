// packages/shared/src/utils/git-provider.ts

export type GitProviderType =
  | "github"
  | "gitlab"
  | "bitbucket"
  | "gitea"
  | "azure_devops"
  | "generic";

export interface DetectedGitProvider {
  providerType: GitProviderType;
  host: string;
  label: string;
  iconName: string;
}

const KNOWN_HOSTS: Record<string, GitProviderType> = {
  "github.com": "github",
  "gitlab.com": "gitlab",
  "bitbucket.org": "bitbucket",
  "dev.azure.com": "azure_devops",
  "ssh.dev.azure.com": "azure_devops",
  "vs-ssh.visualstudio.com": "azure_devops",
};

const PROVIDER_LABELS: Record<GitProviderType, string> = {
  github: "GitHub",
  gitlab: "GitLab",
  bitbucket: "Bitbucket",
  gitea: "Gitea",
  azure_devops: "Azure DevOps",
  generic: "Git",
};

export function detectGitProvider(urlOrHost: string): DetectedGitProvider {
  let host = urlOrHost.trim();
  // Extract hostname from a full URL
  try {
    const parsed = new URL(host.includes("://") ? host : `https://${host}`);
    host = parsed.hostname.toLowerCase();
  } catch {
    host = host.toLowerCase().replace(/^[^@]+@/, "").split(":")[0] ?? host.toLowerCase();
  }

  // Remove www. prefix
  host = host.replace(/^www\./, "");

  let providerType: GitProviderType = KNOWN_HOSTS[host] ?? "generic";

  // Heuristics for self-hosted
  if (providerType === "generic") {
    if (host.includes("gitlab")) providerType = "gitlab";
    else if (host.includes("gitea")) providerType = "gitea";
    else if (host.includes("bitbucket")) providerType = "bitbucket";
    else if (host.includes("visualstudio")) providerType = "azure_devops";
  }

  const isKnownHost = host in KNOWN_HOSTS;
  const label =
    providerType === "gitlab" && !isKnownHost
      ? "GitLab (self-hosted)"
      : providerType === "gitea" && !isKnownHost
        ? "Gitea"
        : PROVIDER_LABELS[providerType];

  return {
    providerType,
    host,
    label,
    iconName: providerType,
  };
}

export function parseRepoUrl(url: string): { host: string; owner: string; repo: string } | null {
  const trimmed = url.trim();
  try {
    // Handle git@ SSH format: git@github.com:org/repo.git
    const sshMatch = trimmed.match(/^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/);
    if (sshMatch) {
      return {
        host: sshMatch[1]!.toLowerCase(),
        owner: sshMatch[2]!,
        repo: sshMatch[3]!,
      };
    }
    // Handle https:// format
    const parsed = new URL(trimmed);
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length < 2) return null;
    return {
      host: parsed.hostname.toLowerCase(),
      owner: segments[0]!,
      repo: segments[1]!.replace(/\.git$/i, ""),
    };
  } catch {
    return null;
  }
}

/**
 * Sanitize a hostname to use as part of an env var key.
 * e.g. "github.com" → "GITHUB_COM"
 */
export function sanitizeEnvKey(host: string): string {
  return host.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}
