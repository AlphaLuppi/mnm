import { describe, it, expect } from "vitest";
import {
  CONNECTOR_TEMPLATES,
  findTemplate,
  type ConnectorTemplate,
} from "../connector-templates.js";

/**
 * CONNECTORS-PLATFORM Sprint 2 — T8.1.2 — template shape tests.
 *
 * Validates the 10 pré-baked templates (Jira/GitHub/GitLab/Microsoft/Google/
 * Slack/ClickUp/Linear/Notion/OpenAI). These templates are sent over the wire
 * via `GET /companies/:companyId/connectors/templates` and are public metadata
 * (no secrets) consumed by the admin wizard. A regression here would surface
 * to the user as a broken wizard — these tests are cheap insurance.
 */
describe("CONNECTOR_TEMPLATES", () => {
  it("exposes the 10 expected templates", () => {
    const slugs = CONNECTOR_TEMPLATES.map((t) => t.slug).sort();
    expect(slugs).toEqual(
      [
        "clickup",
        "github",
        "gitlab",
        "google",
        "jira",
        "linear",
        "microsoft",
        "notion",
        "openai",
        "slack",
      ].sort(),
    );
  });

  it("has unique slugs", () => {
    const slugs = CONNECTOR_TEMPLATES.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  describe.each(CONNECTOR_TEMPLATES)("template $slug", (t: ConnectorTemplate) => {
    it("has required base fields", () => {
      expect(t.slug).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(t.displayName.length).toBeGreaterThan(0);
      expect(t.tagline.length).toBeGreaterThan(0);
      expect(t.icon.length).toBeGreaterThan(0);
      expect(["oauth2", "api_key"]).toContain(t.type);
    });

    if (t.type === "oauth2") {
      it("oauth2 → authorizationUrl + tokenUrl set", () => {
        expect(t.authorizationUrl).toBeTruthy();
        expect(t.tokenUrl).toBeTruthy();
      });

      it("oauth2 → all URLs are HTTPS", () => {
        expect(t.authorizationUrl).toMatch(/^https:\/\//);
        expect(t.tokenUrl).toMatch(/^https:\/\//);
        if (t.userinfoUrl) expect(t.userinfoUrl).toMatch(/^https:\/\//);
      });

      it("oauth2 → scopes is an array (may be empty)", () => {
        expect(Array.isArray(t.scopes)).toBe(true);
      });

      it("oauth2 → no apiKeyLabel set", () => {
        expect(t.apiKeyLabel).toBeUndefined();
      });
    } else {
      it("api_key → apiKeyLabel set", () => {
        expect(t.apiKeyLabel).toBeTruthy();
      });

      it("api_key → no oauth fields", () => {
        expect(t.authorizationUrl).toBeUndefined();
        expect(t.tokenUrl).toBeUndefined();
        expect(t.scopes).toBeUndefined();
      });
    }

    if (t.docsUrl) {
      it("docsUrl is HTTPS", () => {
        expect(t.docsUrl).toMatch(/^https:\/\//);
      });
    }
  });

  describe("findTemplate(slug)", () => {
    it("returns the matching template", () => {
      expect(findTemplate("jira")?.displayName).toBe("Jira");
      expect(findTemplate("openai")?.type).toBe("api_key");
    });

    it("returns undefined for unknown slug", () => {
      expect(findTemplate("does-not-exist")).toBeUndefined();
      expect(findTemplate("")).toBeUndefined();
    });
  });

  describe("provider-specific invariants", () => {
    it("github does NOT advertise refresh (OAuth Apps)", () => {
      const t = findTemplate("github");
      expect(t?.refreshSupported).toBe(false);
    });

    it("microsoft + google + jira advertise refresh", () => {
      expect(findTemplate("microsoft")?.refreshSupported).toBe(true);
      expect(findTemplate("google")?.refreshSupported).toBe(true);
      expect(findTemplate("jira")?.refreshSupported).toBe(true);
    });

    it("openai is the only api_key template", () => {
      const apiKeys = CONNECTOR_TEMPLATES.filter((t) => t.type === "api_key");
      expect(apiKeys).toHaveLength(1);
      expect(apiKeys[0]?.slug).toBe("openai");
    });

    it("jira targets Atlassian auth, not jira.com", () => {
      const t = findTemplate("jira");
      expect(t?.authorizationUrl).toContain("auth.atlassian.com");
      expect(t?.tokenUrl).toContain("auth.atlassian.com");
    });

    it("microsoft uses common tenant for v2.0", () => {
      const t = findTemplate("microsoft");
      expect(t?.authorizationUrl).toContain("login.microsoftonline.com/common/oauth2/v2.0");
    });
  });
});
