/**
 * GITHUB-PROVIDER Phase 5 — tests for the wizard's pure helpers.
 *
 * The React component itself is exercised via Playwright in Phase 6
 * (`e2e/playwright/github-flow.spec.ts`). Here we cover the deep-link builder
 * and the form validators that drive the "Suivant" button enabled state.
 */
import { describe, it, expect } from "vitest";
import {
  buildGitHubAppCreateUrl,
  buildGitHubAppInstallUrl,
  buildInstallationViewUrl,
  initialWizardStep,
  isValidAppId,
  looksLikePemPrivateKey,
  nextStepAfter,
  slugifyCompanyForApp,
  type WizardStep,
} from "../github-app-helpers";

describe("slugifyCompanyForApp", () => {
  it("lowercases and dashes spaces", () => {
    expect(slugifyCompanyForApp("Acme Corp")).toBe("acme-corp");
  });

  it("strips diacritics and special chars", () => {
    expect(slugifyCompanyForApp("L'École 42 — équipe R&D")).toBe(
      "l-cole-42-quipe-r-d",
    );
  });

  it("trims dashes from the edges", () => {
    expect(slugifyCompanyForApp("---Foo Bar---")).toBe("foo-bar");
  });

  it("caps length to 28 chars", () => {
    const long = "a".repeat(80);
    const out = slugifyCompanyForApp(long);
    expect(out.length).toBeLessThanOrEqual(28);
  });
});

describe("isValidAppId", () => {
  it("accepts numeric strings", () => {
    expect(isValidAppId("123456")).toBe(true);
    expect(isValidAppId("9")).toBe(true);
  });

  it("rejects non-numeric strings", () => {
    expect(isValidAppId("abc")).toBe(false);
    expect(isValidAppId("12a3")).toBe(false);
    expect(isValidAppId("")).toBe(false);
  });

  it("ignores surrounding whitespace", () => {
    expect(isValidAppId("  42  ")).toBe(true);
  });
});

describe("looksLikePemPrivateKey", () => {
  const validPem = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAsomekey...
-----END RSA PRIVATE KEY-----`;

  it("accepts a complete PEM block", () => {
    expect(looksLikePemPrivateKey(validPem)).toBe(true);
  });

  it("accepts the modern PKCS8 header", () => {
    const pkcs8 = `-----BEGIN PRIVATE KEY-----
MII...
-----END PRIVATE KEY-----`;
    expect(looksLikePemPrivateKey(pkcs8)).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(looksLikePemPrivateKey("")).toBe(false);
  });

  it("rejects a paste that's missing the header", () => {
    expect(looksLikePemPrivateKey("MIIEpAIBAAKCAQEA...")).toBe(false);
  });

  it("rejects a paste that's missing the footer", () => {
    expect(
      looksLikePemPrivateKey("-----BEGIN RSA PRIVATE KEY-----\nMII..."),
    ).toBe(false);
  });
});

describe("buildGitHubAppCreateUrl", () => {
  it("includes the prefixed name and the callback URL", () => {
    const url = buildGitHubAppCreateUrl({
      origin: "https://mnm.example.com",
      companyName: "Acme Corp",
    });
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://github.com");
    expect(parsed.pathname).toBe("/settings/apps/new");
    expect(parsed.searchParams.get("name")).toBe("mnm-acme-corp");
    expect(parsed.searchParams.get("url")).toBe("https://mnm.example.com");
    expect(parsed.searchParams.getAll("callback_urls[]")).toEqual([
      "https://mnm.example.com/connectors/github/app-install/callback",
    ]);
  });

  it("disables webhooks (V0 — no ingestion yet)", () => {
    const url = buildGitHubAppCreateUrl({
      origin: "https://mnm.example.com",
      companyName: "Foo",
    });
    expect(new URL(url).searchParams.get("webhook_active")).toBe("false");
  });

  it("requests OAuth on install for D7 dual-flow", () => {
    const url = buildGitHubAppCreateUrl({
      origin: "https://mnm.example.com",
      companyName: "Foo",
    });
    expect(new URL(url).searchParams.get("request_oauth_on_install")).toBe(
      "true",
    );
  });

  it("presets the permissions matching what GitHubProvider will need", () => {
    const url = buildGitHubAppCreateUrl({
      origin: "https://mnm.example.com",
      companyName: "Foo",
    });
    const params = new URL(url).searchParams;
    expect(params.get("contents")).toBe("write");
    expect(params.get("metadata")).toBe("read");
    expect(params.get("pull_requests")).toBe("write");
    expect(params.get("actions")).toBe("read");
    expect(params.get("issues")).toBe("write");
  });

  it("falls back to a generic name when slugifying yields empty", () => {
    const url = buildGitHubAppCreateUrl({
      origin: "https://mnm.example.com",
      companyName: "@@@",
    });
    expect(new URL(url).searchParams.get("name")).toBe("mnm-app");
  });
});

describe("buildGitHubAppInstallUrl", () => {
  it("URL-encodes the slug for safety", () => {
    expect(buildGitHubAppInstallUrl("mnm-acme/corp")).toBe(
      "https://github.com/apps/mnm-acme%2Fcorp/installations/new",
    );
  });
});

describe("buildInstallationViewUrl", () => {
  it("uses the org URL shape for Organization installations", () => {
    expect(
      buildInstallationViewUrl("Organization", "acme-org", "12345"),
    ).toBe("https://github.com/organizations/acme-org/settings/installations/12345");
  });

  it("uses the user URL shape for User installations", () => {
    expect(buildInstallationViewUrl("User", "octocat", "67890")).toBe(
      "https://github.com/octocat/settings/installations/67890",
    );
  });

  it("URL-encodes special chars in account login and installation id", () => {
    expect(buildInstallationViewUrl("Organization", "ac me", "12 34")).toBe(
      "https://github.com/organizations/ac%20me/settings/installations/12%2034",
    );
  });
});

describe("initialWizardStep — useState initializer logic", () => {
  it("uses the explicit `entry` when provided (Sheet « Reconfigurer » jumps straight to app-paste)", () => {
    expect(
      initialWizardStep({ entry: "app-paste", hasExistingConnector: true }),
    ).toBe("app-paste");
  });

  it("returns app-banner when the connector already exists and no entry override", () => {
    expect(initialWizardStep({ hasExistingConnector: true })).toBe(
      "app-banner",
    );
  });

  it("returns oauth-credentials for a fresh install (no connector, no entry)", () => {
    expect(initialWizardStep({ hasExistingConnector: false })).toBe(
      "oauth-credentials",
    );
  });

  it("`entry` overrides even an existing connector", () => {
    expect(
      initialWizardStep({
        entry: "app-install",
        hasExistingConnector: true,
      }),
    ).toBe("app-install");
  });

  it("`entry` overrides even when no connector exists", () => {
    expect(
      initialWizardStep({
        entry: "app-create",
        hasExistingConnector: false,
      }),
    ).toBe("app-create");
  });
});

describe("nextStepAfter — wizard state machine", () => {
  it("oauth-credentials → app-banner", () => {
    expect(nextStepAfter("oauth-credentials")).toBe("app-banner");
  });

  it("app-banner stops on skip", () => {
    expect(nextStepAfter("app-banner", "skip")).toBeNull();
  });

  it("app-banner advances on configure", () => {
    expect(nextStepAfter("app-banner", "configure")).toBe("app-create");
  });

  it("app-create → app-paste", () => {
    expect(nextStepAfter("app-create")).toBe("app-paste");
  });

  it("app-paste → app-install", () => {
    expect(nextStepAfter("app-paste")).toBe("app-install");
  });

  it("app-install is terminal", () => {
    expect(nextStepAfter("app-install")).toBeNull();
  });

  it("rejects unknown steps gracefully", () => {
    expect(nextStepAfter("not-a-step" as WizardStep)).toBeNull();
  });
});
