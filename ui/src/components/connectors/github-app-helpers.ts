/**
 * GITHUB-PROVIDER Phase 5 — pure helpers used by the GitHub App wizard / sheet.
 *
 * Kept in a standalone module so vitest can exercise the deep-link builder and
 * the validation predicates without mounting React. The component imports them
 * verbatim — never duplicate the logic in the JSX file.
 */

/**
 * Sanitize a free-form company name (or issuePrefix) into a stable GitHub App
 * name fragment. GitHub limits App names to ASCII letters, digits and dashes ;
 * we lowercase, strip whitespace, then collapse anything else to a dash.
 *
 * The resulting string is suffixed by the caller (e.g. `mnm-${slug}`) and is
 * not enforced unique — admins can override on github.com.
 */
export function slugifyCompanyForApp(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28); // leaves room for the "mnm-" prefix under the 34-char GH limit
}

/**
 * Validate a GitHub App ID. GitHub returns a numeric ID (text in the API
 * payload). We accept any non-empty digit string — leave deeper validation to
 * the server (which JWT-signs against the App and reads the response).
 */
export function isValidAppId(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

/**
 * Surface-level validation of a PEM private key paste. We're not parsing the
 * key (the server does that — it tries a JWT-signed `POST /app` and returns
 * 422 if the key is rejected). We just check that it looks like a PEM block
 * so the user gets immediate feedback if they paste garbage.
 */
export function looksLikePemPrivateKey(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed.startsWith("-----BEGIN")) return false;
  if (!trimmed.includes("PRIVATE KEY-----")) return false;
  if (!trimmed.endsWith("-----")) return false;
  return true;
}

/**
 * Build the deep-link URL admins click to register a new GitHub App on
 * github.com. The query string presets the App name + URL + callback so the
 * admin only has to confirm permissions and paste the resulting App ID +
 * private key back in MnM.
 *
 * Permissions match what the GitHubProvider class actually needs in Phase 2 :
 * - contents=write    (commit / branch / tag operations)
 * - metadata=read     (always required by GitHub)
 * - pull_requests=write (open PRs from governed workflows)
 * - actions=read      (CI status read-back for gates)
 * - issues=write      (CC plugin import + governed workflows file ops)
 *
 * The callback URL is the per-instance install handler shipped by Phase 1
 * (`/connectors/github/app-install/callback`), browser-side only — no UI
 * fetch hits it.
 */
export function buildGitHubAppCreateUrl(params: {
  origin: string;
  companyName: string;
}): string {
  const slug = slugifyCompanyForApp(params.companyName);
  // `mnm-` prefix avoids accidental name collisions across MnM instances when
  // multiple companies use the same display name. Admins can rename on GH.
  const name = `mnm-${slug || "app"}`;
  const callbackUrl = `${params.origin}/connectors/github/app-install/callback`;

  // GitHub honours a manifest-style query string for new App creation. We do
  // not embed a webhook URL (V0 — no webhook ingestion, Phase 1 R3) ; that's
  // why webhook_active=false. request_oauth_on_install=true so the user OAuth
  // flow piggy-backs on the install (D7 dual-flow).
  const qs = new URLSearchParams({
    name,
    url: params.origin,
    "callback_urls[]": callbackUrl,
    webhook_active: "false",
    request_oauth_on_install: "true",
    contents: "write",
    metadata: "read",
    pull_requests: "write",
    actions: "read",
    issues: "write",
  });
  return `https://github.com/settings/apps/new?${qs.toString()}`;
}

/**
 * Build the deep-link URL to install an already-created App on a new org.
 * `appSlug` is returned by GitHub (`/app` endpoint) and persisted by the
 * backend in the `github_apps` table.
 */
export function buildGitHubAppInstallUrl(appSlug: string): string {
  return `https://github.com/apps/${encodeURIComponent(
    appSlug,
  )}/installations/new`;
}

/**
 * Build the deep-link URL to view (or remove) an installation on github.com.
 * Org and personal installations use different URL shapes ; the wizard hides
 * this discrepancy from the user.
 */
export function buildInstallationViewUrl(
  accountType: "User" | "Organization",
  accountLogin: string,
  installationId: string,
): string {
  const enc = encodeURIComponent;
  if (accountType === "Organization") {
    return `https://github.com/organizations/${enc(
      accountLogin,
    )}/settings/installations/${enc(installationId)}`;
  }
  return `https://github.com/${enc(accountLogin)}/settings/installations/${enc(
    installationId,
  )}`;
}

/**
 * Steps of the adaptive wizard. Pure state machine — the component drives
 * transitions by setting `step`, but tests can assert the allowed sequence
 * without touching the component.
 */
export type WizardStep =
  | "oauth-credentials" // step 1 — paste Client ID + Client Secret
  | "app-banner" // step 2 — "configure App or skip" choice
  | "app-create" // step 3a — deep-link to github.com to register the App
  | "app-paste" // step 3b — paste appId + privateKey + webhookSecret?
  | "app-install"; // step 3c — deep-link install + wait for SSE

/**
 * Compute the wizard's initial step from the props passed by the parent.
 *
 * Rules (mirrors `useState<WizardStep>` initializer in GitHubConnectorWizard) :
 *  1. An explicit `entry` from the caller wins — used by the Sheet's
 *     « Reconfigurer » button to jump straight to `app-paste`.
 *  2. Otherwise, if the connector already exists, the OAuth step is done →
 *     start at the `app-banner` (« configure or skip ? »).
 *  3. Otherwise (fresh install), start at `oauth-credentials`.
 *
 * Pure function so vitest can exercise the branching without React.
 */
export function initialWizardStep(params: {
  entry?: WizardStep;
  hasExistingConnector: boolean;
}): WizardStep {
  if (params.entry) return params.entry;
  if (params.hasExistingConnector) return "app-banner";
  return "oauth-credentials";
}

export function nextStepAfter(step: WizardStep, choice?: "configure" | "skip"): WizardStep | null {
  switch (step) {
    case "oauth-credentials":
      return "app-banner";
    case "app-banner":
      if (choice === "configure") return "app-create";
      if (choice === "skip") return null; // wizard exits — caller closes
      return null;
    case "app-create":
      return "app-paste";
    case "app-paste":
      return "app-install";
    case "app-install":
      return null; // terminal — "Terminer" closes the wizard
    default:
      return null;
  }
}
