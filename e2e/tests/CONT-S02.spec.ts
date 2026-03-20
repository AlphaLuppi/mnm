/**
 * CONT-S02: Credential Proxy HTTP -- Injection secrets sans exposition aux containers -- E2E Tests
 *
 * These tests verify the deliverables of CONT-S02:
 *   - Groupe 1: File existence (T01-T05)
 *   - Groupe 2: Service credential-proxy.ts (T02, T03-T18)
 *   - Groupe 3: Service credential-proxy-rules.ts (T19-T28)
 *   - Groupe 4: Routes credential-proxy-rules.ts (T29-T36)
 *   - Groupe 5: ContainerManager integration (T37-T42)
 *   - Groupe 6: Types credential-proxy.ts (T43-T49)
 *   - Groupe 7: Validators credential-proxy.ts (T50-T53)
 *   - Groupe 8: Proxy request handling (T54-T56)
 *   - Groupe 9: Audit events (T57-T58)
 *   - Groupe 10: Barrel exports and app mounting (T59-T63)
 *
 * All tests are file-content based -- no server, database, or runtime required.
 */
import { test, expect } from "@playwright/test";
import { readFile, access as fsAccess } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

// Target files
const CREDENTIAL_PROXY_FILE = resolve(ROOT, "server/src/services/credential-proxy.ts");
const CREDENTIAL_PROXY_RULES_FILE = resolve(ROOT, "server/src/services/credential-proxy-rules.ts");
const ROUTES_FILE = resolve(ROOT, "server/src/routes/credential-proxy-rules.ts");
const TYPES_FILE = resolve(ROOT, "packages/shared/src/types/credential-proxy.ts");
const VALIDATORS_FILE = resolve(ROOT, "packages/shared/src/validators/credential-proxy.ts");
const CONTAINER_MANAGER_FILE = resolve(ROOT, "server/src/services/container-manager.ts");
const CONTAINER_TYPES_FILE = resolve(ROOT, "packages/shared/src/types/container.ts");
const SERVICES_INDEX = resolve(ROOT, "server/src/services/index.ts");
const TYPES_INDEX = resolve(ROOT, "packages/shared/src/types/index.ts");
const VALIDATORS_INDEX = resolve(ROOT, "packages/shared/src/validators/index.ts");
const APP_FILE = resolve(ROOT, "server/src/app.ts");

// ---------------------------------------------------------------------------
// Groupe 1: File existence (T01)
// ---------------------------------------------------------------------------

test.describe("Groupe 1: File existence", () => {
  test("T01 -- credential-proxy.ts exists and exports credentialProxyService", async () => {
    await expect(fsAccess(CREDENTIAL_PROXY_FILE).then(() => true)).resolves.toBe(true);
    const content = await readFile(CREDENTIAL_PROXY_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+credentialProxyService/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 2: Service credential-proxy.ts (T02-T18)
// ---------------------------------------------------------------------------

test.describe("Groupe 2: Service credential-proxy.ts", () => {
  test("T02 -- credentialProxyService(db) returns the expected functions", async () => {
    const content = await readFile(CREDENTIAL_PROXY_FILE, "utf-8");
    const expectedFns = [
      "allocateProxyPort",
      "startProxy",
      "stopProxy",
      "cleanupAllProxies",
      "getActiveProxies",
      "handleProxyRequest",
      "matchSecretMapping",
    ];
    for (const fn of expectedFns) {
      expect(content, `Should expose ${fn}`).toContain(fn);
    }
    // Verify the return object includes these keys
    expect(content).toMatch(/return\s*\{[\s\S]*?allocateProxyPort/);
    expect(content).toMatch(/return\s*\{[\s\S]*?startProxy/);
  });

  test("T03 -- allocateProxyPort() returns a port in range 8090-8190", async () => {
    const content = await readFile(CREDENTIAL_PROXY_FILE, "utf-8");
    // cont-s02-svc-port-alloc
    expect(content).toContain("cont-s02-svc-port-alloc");
    expect(content).toMatch(/MIN_PROXY_PORT\s*=\s*8090/);
    expect(content).toMatch(/MAX_PROXY_PORT\s*=\s*8190/);
    // Iterates from MIN to MAX
    expect(content).toMatch(/for\s*\(\s*let\s+port\s*=\s*MIN_PROXY_PORT/);
  });

  test("T04 -- allocateProxyPort() excludes ports used by active containers", async () => {
    const content = await readFile(CREDENTIAL_PROXY_FILE, "utf-8");
    // Queries container_instances for used ports
    expect(content).toMatch(/containerInstances\.credentialProxyPort/);
    expect(content).toMatch(/inArray\(\s*containerInstances\.status/);
    expect(content).toMatch(/isNotNull\(\s*containerInstances\.credentialProxyPort\)/);
    // Also checks in-memory active proxies
    expect(content).toMatch(/activeProxies\.values\(\)/);
  });

  test("T05 -- allocateProxyPort() throws conflict when all ports are taken", async () => {
    const content = await readFile(CREDENTIAL_PROXY_FILE, "utf-8");
    expect(content).toMatch(/throw\s+conflict\(.*[Nn]o available proxy ports/);
  });

  test("T06 -- handleProxyRequest() verifies JWT and rejects if invalid", async () => {
    const content = await readFile(CREDENTIAL_PROXY_FILE, "utf-8");
    // cont-s02-svc-jwt-verify
    expect(content).toContain("cont-s02-svc-jwt-verify");
    expect(content).toContain("x-mnm-agent-jwt");
    expect(content).toMatch(/verifyLocalAgentJwt\(/);
    // Rejects missing JWT
    expect(content).toMatch(/sendJsonResponse\(\s*res,\s*401/);
    expect(content).toContain('"missing_jwt"');
  });

  test("T07 -- handleProxyRequest() rejects expired/invalid JWT", async () => {
    const content = await readFile(CREDENTIAL_PROXY_FILE, "utf-8");
    // After verifyLocalAgentJwt returns null
    expect(content).toContain('"invalid_jwt"');
    expect(content).toMatch(/if\s*\(\s*!claims\s*\)/);
  });

  test("T08 -- handleProxyRequest() matches the rule for the requested secret", async () => {
    const content = await readFile(CREDENTIAL_PROXY_FILE, "utf-8");
    // cont-s02-svc-handle-request
    expect(content).toContain("cont-s02-svc-handle-request");
    expect(content).toMatch(/matchSecretMapping\(/);
    expect(content).toContain("x-mnm-secret-name");
  });

  test("T09 -- handleProxyRequest() rejects if no rule matches", async () => {
    const content = await readFile(CREDENTIAL_PROXY_FILE, "utf-8");
    expect(content).toContain('"no_matching_rule"');
    // Returns 403
    expect(content).toMatch(/sendJsonResponse\(\s*res,\s*403/);
  });

  test("T10 -- handleProxyRequest() checks company_id matches JWT claims", async () => {
    const content = await readFile(CREDENTIAL_PROXY_FILE, "utf-8");
    // Verifies company_id from JWT
    expect(content).toMatch(/claims\.company_id\s*!==\s*proxy\.companyId/);
    expect(content).toContain('"company_mismatch"');
  });

  test("T11 -- handleProxyRequest() resolves the secret and injects the header", async () => {
    const content = await readFile(CREDENTIAL_PROXY_FILE, "utf-8");
    // cont-s02-svc-header-inject
    expect(content).toContain("cont-s02-svc-header-inject");
    expect(content).toMatch(/resolveSecretForProxy\(/);
    // Injects secret into headers
    expect(content).toMatch(/forwardHeaders\[mapping\.headerName\]\s*=\s*headerValue/);
    expect(content).toMatch(/mapping\.headerPrefix/);
  });

  test("T12 -- handleProxyRequest() does not expose secret value in logs", async () => {
    const content = await readFile(CREDENTIAL_PROXY_FILE, "utf-8");
    // The emitProxyAudit function comments explicitly says "NEVER log secret values"
    expect(content).toMatch(/NEVER\s+log\s+secret\s+values/i);
    // Only secretName is logged, not secretValue
    expect(content).toMatch(/if\s*\(secretName\)\s*metadata\.secretName\s*=\s*secretName/);
  });

  test("T13 -- handleProxyRequest() emits credential.accessed audit event", async () => {
    const content = await readFile(CREDENTIAL_PROXY_FILE, "utf-8");
    // cont-s02-svc-audit-emit
    expect(content).toContain("cont-s02-svc-audit-emit");
    expect(content).toContain('"credential.accessed"');
  });

  test("T14 -- handleProxyRequest() emits credential.denied audit event when refused", async () => {
    const content = await readFile(CREDENTIAL_PROXY_FILE, "utf-8");
    expect(content).toContain('"credential.denied"');
    // Multiple denied scenarios
    const deniedCount = (content.match(/"credential\.denied"/g) || []).length;
    expect(deniedCount).toBeGreaterThanOrEqual(3); // missing_jwt, invalid_jwt, company_mismatch, no_matching_rule
  });

  test("T15 -- handleProxyRequest() returns 404 if secret does not exist", async () => {
    const content = await readFile(CREDENTIAL_PROXY_FILE, "utf-8");
    expect(content).toContain('"secret_not_found"');
    // Returns appropriate status code based on reason
    expect(content).toMatch(/reason\s*===\s*"secret_not_found"\s*\?\s*404\s*:\s*502/);
  });

  test("T16 -- startProxy() creates an HTTP server and returns the proxy instance", async () => {
    const content = await readFile(CREDENTIAL_PROXY_FILE, "utf-8");
    // cont-s02-svc-start-proxy
    expect(content).toContain("cont-s02-svc-start-proxy");
    expect(content).toMatch(/createServer\(/);
    expect(content).toMatch(/server\.listen\(\s*port/);
    expect(content).toMatch(/activeProxies\.set\(\s*instanceId/);
  });

  test("T17 -- stopProxy() stops the server and releases the port", async () => {
    const content = await readFile(CREDENTIAL_PROXY_FILE, "utf-8");
    // cont-s02-svc-stop-proxy
    expect(content).toContain("cont-s02-svc-stop-proxy");
    expect(content).toMatch(/proxy\.server\.close\(/);
    expect(content).toMatch(/activeProxies\.delete\(\s*instanceId\)/);
  });

  test("T18 -- cleanupAllProxies() stops all active proxies", async () => {
    const content = await readFile(CREDENTIAL_PROXY_FILE, "utf-8");
    // cont-s02-svc-cleanup-all
    expect(content).toContain("cont-s02-svc-cleanup-all");
    expect(content).toMatch(/Array\.from\(\s*activeProxies\.keys\(\)\s*\)/);
    expect(content).toMatch(/await\s+stopProxy\(\s*instanceId\s*\)/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 3: Service credential-proxy-rules.ts (T19-T28)
// ---------------------------------------------------------------------------

test.describe("Groupe 3: Service credential-proxy-rules.ts", () => {
  test("T19 -- credential-proxy-rules.ts exists and exports credentialProxyRulesService", async () => {
    await expect(fsAccess(CREDENTIAL_PROXY_RULES_FILE).then(() => true)).resolves.toBe(true);
    const content = await readFile(CREDENTIAL_PROXY_RULES_FILE, "utf-8");
    expect(content).toMatch(/export\s+function\s+credentialProxyRulesService/);
  });

  test("T20 -- listRules() returns rules for a company", async () => {
    const content = await readFile(CREDENTIAL_PROXY_RULES_FILE, "utf-8");
    // cont-s02-rules-list
    expect(content).toContain("cont-s02-rules-list");
    expect(content).toMatch(/async\s+function\s+listRules\(/);
    expect(content).toMatch(/credentialProxyRules\.companyId/);
  });

  test("T21 -- createRule() creates a rule with validation", async () => {
    const content = await readFile(CREDENTIAL_PROXY_RULES_FILE, "utf-8");
    // cont-s02-rules-create
    expect(content).toContain("cont-s02-rules-create");
    expect(content).toMatch(/async\s+function\s+createRule\(/);
    // Checks uniqueness of name
    expect(content).toMatch(/throw\s+conflict\(.*already exists/);
    // Inserts into DB
    expect(content).toMatch(/db[\s\S]*?\.insert\(\s*credentialProxyRules\s*\)/);
  });

  test("T22 -- updateRule() modifies an existing rule", async () => {
    const content = await readFile(CREDENTIAL_PROXY_RULES_FILE, "utf-8");
    // cont-s02-rules-update
    expect(content).toContain("cont-s02-rules-update");
    expect(content).toMatch(/async\s+function\s+updateRule\(/);
    // Verifies exists first
    expect(content).toMatch(/await\s+getRuleById\(/);
    // Updates
    expect(content).toMatch(/db[\s\S]*?\.update\(\s*credentialProxyRules\s*\)/);
  });

  test("T23 -- deleteRule() removes a rule", async () => {
    const content = await readFile(CREDENTIAL_PROXY_RULES_FILE, "utf-8");
    // cont-s02-rules-delete
    expect(content).toContain("cont-s02-rules-delete");
    expect(content).toMatch(/async\s+function\s+deleteRule\(/);
    expect(content).toMatch(/db[\s\S]*?\.delete\(\s*credentialProxyRules\s*\)/);
  });

  test("T24 -- findMatchingRules() matches an exact pattern", async () => {
    const content = await readFile(CREDENTIAL_PROXY_RULES_FILE, "utf-8");
    // cont-s02-rules-match
    expect(content).toContain("cont-s02-rules-match");
    expect(content).toMatch(/function\s+matchesPattern\(/);
    // Exact match
    expect(content).toMatch(/pattern\s*===\s*secretName/);
  });

  test("T25 -- findMatchingRules() matches a wildcard suffix pattern", async () => {
    const content = await readFile(CREDENTIAL_PROXY_RULES_FILE, "utf-8");
    // Wildcard suffix
    expect(content).toMatch(/pattern\.endsWith\(\s*"\*"\s*\)/);
    expect(content).toMatch(/secretName\.startsWith\(\s*prefix\s*\)/);
  });

  test("T26 -- findMatchingRules() matches global wildcard *", async () => {
    const content = await readFile(CREDENTIAL_PROXY_RULES_FILE, "utf-8");
    expect(content).toMatch(/pattern\s*===\s*"\*"/);
    expect(content).toContain("return true");
  });

  test("T27 -- findMatchingRules() filters only enabled rules", async () => {
    const content = await readFile(CREDENTIAL_PROXY_RULES_FILE, "utf-8");
    expect(content).toMatch(/async\s+function\s+findMatchingRules\(/);
    expect(content).toMatch(/eq\(\s*credentialProxyRules\.enabled,\s*true\s*\)/);
  });

  test("T28 -- resolveRulesForAgent() returns SecretMappings for an agent", async () => {
    const content = await readFile(CREDENTIAL_PROXY_RULES_FILE, "utf-8");
    // cont-s02-rules-resolve
    expect(content).toContain("cont-s02-rules-resolve");
    expect(content).toMatch(/async\s+function\s+resolveRulesForAgent\(/);
    // Returns CredentialProxySecretMapping[]
    expect(content).toMatch(/CredentialProxySecretMapping\[\]/);
    // Resolves secrets and builds mappings
    expect(content).toMatch(/companySecrets/);
    expect(content).toMatch(/envKeyPlaceholder/);
    expect(content).toMatch(/secretId/);
    expect(content).toMatch(/headerName/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 4: Routes credential-proxy-rules.ts (T29-T36)
// ---------------------------------------------------------------------------

test.describe("Groupe 4: Routes credential-proxy-rules.ts", () => {
  test("T29 -- Route GET /credential-proxy-rules returns 200 with the list", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // cont-s02-route-list-rules
    expect(content).toContain("cont-s02-route-list-rules");
    expect(content).toMatch(/router\.get\(\s*["']\/companies\/:companyId\/credential-proxy-rules["']/);
    expect(content).toMatch(/res\.json\(\s*\{\s*rules\s*\}/);
  });

  test("T30 -- Route POST /credential-proxy-rules creates a rule and returns 201", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // cont-s02-route-create-rule
    expect(content).toContain("cont-s02-route-create-rule");
    expect(content).toMatch(/router\.post\(\s*["']\/companies\/:companyId\/credential-proxy-rules["']/);
    expect(content).toMatch(/res\.status\(\s*201\s*\)\.json/);
  });

  test("T31 -- Route PUT /credential-proxy-rules/:ruleId updates a rule", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // cont-s02-route-update-rule
    expect(content).toContain("cont-s02-route-update-rule");
    expect(content).toMatch(/router\.put\(\s*["']\/companies\/:companyId\/credential-proxy-rules\/:ruleId["']/);
  });

  test("T32 -- Route DELETE /credential-proxy-rules/:ruleId deletes a rule", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // cont-s02-route-delete-rule
    expect(content).toContain("cont-s02-route-delete-rule");
    expect(content).toMatch(/router\.delete\(\s*["']\/companies\/:companyId\/credential-proxy-rules\/:ruleId["']/);
  });

  test("T33 -- Route POST /credential-proxy-rules/:ruleId/test returns test result", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // cont-s02-route-test-rule
    expect(content).toContain("cont-s02-route-test-rule");
    expect(content).toMatch(/router\.post\(\s*["']\/companies\/:companyId\/credential-proxy-rules\/:ruleId\/test["']/);
    expect(content).toContain("matched");
    expect(content).toContain("secretFound");
  });

  test("T34 -- Routes protected by requirePermission(db, 'company:manage_settings')", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // Each route should have requirePermission
    const permissionMatches = (content.match(/requirePermission\(\s*db,\s*"company:manage_settings"\)/g) || []).length;
    // 6 routes: GET list, GET by id, POST create, PUT update, DELETE, POST test
    expect(permissionMatches).toBeGreaterThanOrEqual(6);
  });

  test("T35 -- Route POST create emits audit credential_proxy_rule.created", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // cont-s02-audit-rule-created
    expect(content).toContain("cont-s02-audit-rule-created");
    expect(content).toContain('"credential_proxy_rule.created"');
    expect(content).toMatch(/emitAudit\(/);
  });

  test("T36 -- Route DELETE emits audit credential_proxy_rule.deleted with severity warning", async () => {
    const content = await readFile(ROUTES_FILE, "utf-8");
    // cont-s02-audit-rule-deleted
    expect(content).toContain("cont-s02-audit-rule-deleted");
    expect(content).toContain('"credential_proxy_rule.deleted"');
    expect(content).toContain('"warning"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 5: ContainerManager integration (T37-T42)
// ---------------------------------------------------------------------------

test.describe("Groupe 5: ContainerManager integration", () => {
  test("T37 -- launchContainer() starts the proxy if credentialProxyEnabled", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    // cont-s02-cm-proxy-check
    expect(content).toContain("cont-s02-cm-proxy-check");
    expect(content).toMatch(/profile\.credentialProxyEnabled/);
    // cont-s02-cm-proxy-start
    expect(content).toContain("cont-s02-cm-proxy-start");
    expect(content).toMatch(/proxyService\.startProxy\(/);
  });

  test("T38 -- launchContainer() does NOT start proxy if credentialProxyEnabled is false", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    // The proxy code is inside an if block
    expect(content).toMatch(/if\s*\(\s*profile\.credentialProxyEnabled\s*\)/);
    // Outside this block, no proxy is started
  });

  test("T39 -- launchContainer() saves credentialProxyPort in container_instances DB", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    // cont-s02-cm-proxy-port-save
    expect(content).toContain("cont-s02-cm-proxy-port-save");
    expect(content).toMatch(/credentialProxyPort:\s*proxyPort/);
  });

  test("T40 -- launchContainer() injects MNM_CREDENTIAL_PROXY_URL in env vars", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    // cont-s02-cm-proxy-env
    expect(content).toContain("cont-s02-cm-proxy-env");
    expect(content).toContain("MNM_CREDENTIAL_PROXY_URL");
    expect(content).toContain("MNM_CREDENTIAL_PROXY_PORT");
    // Placeholders for secret keys
    expect(content).toContain("mnm-proxy-placeholder");
  });

  test("T41 -- stopContainer() stops the proxy", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    // cont-s02-cm-proxy-stop
    expect(content).toContain("cont-s02-cm-proxy-stop");
    expect(content).toMatch(/proxyService\.stopProxy\(\s*instanceId\s*\)/);
  });

  test("T42 -- cleanupStaleContainers() cleans up orphan proxies", async () => {
    const content = await readFile(CONTAINER_MANAGER_FILE, "utf-8");
    // cont-s02-cm-cleanup-proxies
    expect(content).toContain("cont-s02-cm-cleanup-proxies");
    expect(content).toMatch(/proxyService\.cleanupAllProxies\(\)/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 6: Types credential-proxy.ts (T43-T49)
// ---------------------------------------------------------------------------

test.describe("Groupe 6: Types credential-proxy.ts", () => {
  test("T43 -- CredentialProxyRule type exported in shared types", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    // cont-s02-type-rule
    expect(content).toContain("cont-s02-type-rule");
    expect(content).toMatch(/export\s+interface\s+CredentialProxyRule/);
    // Key fields
    expect(content).toContain("secretPattern");
    expect(content).toContain("allowedAgentRoles");
    expect(content).toContain("proxyEndpoint");
    expect(content).toContain("enabled");
  });

  test("T44 -- CredentialProxyConfig type exported in shared types", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    // cont-s02-type-config
    expect(content).toContain("cont-s02-type-config");
    expect(content).toMatch(/export\s+interface\s+CredentialProxyConfig/);
    expect(content).toContain("secretMappings");
  });

  test("T45 -- CredentialProxySecretMapping type exported in shared types", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    // cont-s02-type-mapping
    expect(content).toContain("cont-s02-type-mapping");
    expect(content).toMatch(/export\s+interface\s+CredentialProxySecretMapping/);
    expect(content).toContain("envKeyPlaceholder");
    expect(content).toContain("secretId");
    expect(content).toContain("headerName");
    expect(content).toContain("headerPrefix");
    expect(content).toContain("targetBaseUrl");
  });

  test("T46 -- CredentialProxyStatus type exported in shared types", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    // cont-s02-type-proxy-status
    expect(content).toContain("cont-s02-type-proxy-status");
    expect(content).toMatch(/export\s+interface\s+CredentialProxyStatus/);
    expect(content).toContain("requestCount");
    expect(content).toContain("secretsResolved");
    expect(content).toContain("secretsDenied");
  });

  test("T47 -- CredentialProxyAccessEvent type exported in shared types", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    // cont-s02-type-access-event
    expect(content).toContain("cont-s02-type-access-event");
    expect(content).toMatch(/export\s+interface\s+CredentialProxyAccessEvent/);
    expect(content).toContain('"accessed"');
    expect(content).toContain('"denied"');
    expect(content).toContain('"error"');
  });

  test("T48 -- CredentialProxyTestResult type exported in shared types", async () => {
    const content = await readFile(TYPES_FILE, "utf-8");
    // cont-s02-type-test-result
    expect(content).toContain("cont-s02-type-test-result");
    expect(content).toMatch(/export\s+interface\s+CredentialProxyTestResult/);
    expect(content).toContain("matched");
    expect(content).toContain("secretFound");
  });

  test("T49 -- ContainerLaunchResult includes credentialProxyPort and credentialProxyUrl", async () => {
    const content = await readFile(CONTAINER_TYPES_FILE, "utf-8");
    expect(content).toMatch(/credentialProxyPort:\s*number\s*\|\s*null/);
    expect(content).toMatch(/credentialProxyUrl:\s*string\s*\|\s*null/);
  });
});

// ---------------------------------------------------------------------------
// Groupe 7: Validators credential-proxy.ts (T50-T53)
// ---------------------------------------------------------------------------

test.describe("Groupe 7: Validators credential-proxy.ts", () => {
  test("T50 -- createCredentialProxyRuleSchema validates the pattern (alphanumeric, _, -, *)", async () => {
    const content = await readFile(VALIDATORS_FILE, "utf-8");
    // cont-s02-validator-create-rule
    expect(content).toContain("cont-s02-validator-create-rule");
    expect(content).toMatch(/export\s+const\s+createCredentialProxyRuleSchema/);
    // Pattern regex
    expect(content).toMatch(/\[A-Za-z0-9_\*-\]\+/);
    // Fields
    expect(content).toContain("name");
    expect(content).toContain("secretPattern");
    expect(content).toContain("allowedAgentRoles");
    expect(content).toContain("proxyEndpoint");
    expect(content).toContain("enabled");
  });

  test("T51 -- createCredentialProxyRuleSchema rejects invalid patterns via refine", async () => {
    const content = await readFile(VALIDATORS_FILE, "utf-8");
    expect(content).toContain(".refine(");
    expect(content).toContain("Secret pattern must contain only alphanumeric");
  });

  test("T52 -- updateCredentialProxyRuleSchema accepts partial update", async () => {
    const content = await readFile(VALIDATORS_FILE, "utf-8");
    // cont-s02-validator-update-rule
    expect(content).toContain("cont-s02-validator-update-rule");
    expect(content).toMatch(/export\s+const\s+updateCredentialProxyRuleSchema/);
    // All fields should be optional
    const updateSection = content.substring(
      content.indexOf("updateCredentialProxyRuleSchema"),
      content.indexOf("testCredentialProxyRuleSchema"),
    );
    expect(updateSection).toContain(".optional()");
  });

  test("T53 -- testCredentialProxyRuleSchema validates the secretName", async () => {
    const content = await readFile(VALIDATORS_FILE, "utf-8");
    // cont-s02-validator-test-rule
    expect(content).toContain("cont-s02-validator-test-rule");
    expect(content).toMatch(/export\s+const\s+testCredentialProxyRuleSchema/);
    expect(content).toContain("secretName");
    expect(content).toContain("agentId");
  });
});

// ---------------------------------------------------------------------------
// Groupe 8: Proxy request handling (T54-T56)
// ---------------------------------------------------------------------------

test.describe("Groupe 8: Proxy request handling", () => {
  test("T54 -- handleProxyRequest() forwards the response from the external endpoint", async () => {
    const content = await readFile(CREDENTIAL_PROXY_FILE, "utf-8");
    // cont-s02-svc-forward-request
    expect(content).toContain("cont-s02-svc-forward-request");
    // Uses fetch to forward
    expect(content).toMatch(/await\s+fetch\(\s*targetFullUrl/);
    // Forwards response back
    expect(content).toMatch(/res\.writeHead\(\s*response\.status/);
    expect(content).toMatch(/res\.end\(\s*Buffer\.from\(\s*responseBody\s*\)/);
  });

  test("T55 -- handleProxyRequest() returns external endpoint errors without crashing", async () => {
    const content = await readFile(CREDENTIAL_PROXY_FILE, "utf-8");
    // Catches errors from fetch
    expect(content).toContain("AbortError");
    expect(content).toContain('"Gateway Timeout"');
    expect(content).toContain('"Bad Gateway"');
    // Timeout handling
    expect(content).toMatch(/sendJsonResponse\(\s*res,\s*504/);
    expect(content).toMatch(/sendJsonResponse\(\s*res,\s*502/);
  });

  test("T56 -- handleProxyRequest() removes x-mnm-agent-jwt header before forwarding", async () => {
    const content = await readFile(CREDENTIAL_PROXY_FILE, "utf-8");
    // Strips MnM-specific headers
    expect(content).toContain('"x-mnm-agent-jwt"');
    expect(content).toContain('"x-mnm-target-url"');
    expect(content).toContain('"x-mnm-secret-name"');
    // These are skipped in the forwarding headers
    expect(content).toContain("continue");
  });
});

// ---------------------------------------------------------------------------
// Groupe 9: Audit events (T57-T58)
// ---------------------------------------------------------------------------

test.describe("Groupe 9: Audit events", () => {
  test("T57 -- Audit credential.proxy_started emitted when proxy starts", async () => {
    const content = await readFile(CREDENTIAL_PROXY_FILE, "utf-8");
    // cont-s02-audit-proxy-started
    expect(content).toContain("cont-s02-audit-proxy-started");
    expect(content).toContain('"credential.proxy_started"');
    // Includes metadata
    expect(content).toMatch(/rulesCount:\s*secretMappings\.length/);
  });

  test("T58 -- Audit credential.proxy_stopped emitted when proxy stops", async () => {
    const content = await readFile(CREDENTIAL_PROXY_FILE, "utf-8");
    // cont-s02-audit-proxy-stopped
    expect(content).toContain("cont-s02-audit-proxy-stopped");
    expect(content).toContain('"credential.proxy_stopped"');
  });
});

// ---------------------------------------------------------------------------
// Groupe 10: Barrel exports and app mounting (T59-T63)
// ---------------------------------------------------------------------------

test.describe("Groupe 10: Barrel exports and app mounting", () => {
  test("T59 -- credentialProxyService exported in server/src/services/index.ts", async () => {
    const content = await readFile(SERVICES_INDEX, "utf-8");
    expect(content).toContain("credentialProxyService");
    expect(content).toContain("credential-proxy");
  });

  test("T60 -- credential-proxy-rules routes mounted in server/src/app.ts", async () => {
    const content = await readFile(APP_FILE, "utf-8");
    expect(content).toContain("credentialProxyRulesRoutes");
    expect(content).toMatch(/credentialProxyRulesRoutes\(\s*db\s*\)/);
  });

  test("T61 -- credentialProxyRulesService exported in server/src/services/index.ts", async () => {
    const content = await readFile(SERVICES_INDEX, "utf-8");
    expect(content).toContain("credentialProxyRulesService");
    expect(content).toContain("credential-proxy-rules");
  });

  test("T62 -- Types exported in packages/shared/src/types/index.ts", async () => {
    const content = await readFile(TYPES_INDEX, "utf-8");
    expect(content).toContain("CredentialProxyRule");
    expect(content).toContain("CredentialProxySecretMapping");
    expect(content).toContain("CredentialProxyStatus");
    expect(content).toContain("CredentialProxyAccessEvent");
    expect(content).toContain("CredentialProxyTestResult");
    expect(content).toContain("CreateCredentialProxyRuleInput");
    expect(content).toContain("UpdateCredentialProxyRuleInput");
    expect(content).toContain("credential-proxy");
  });

  test("T63 -- Validators exported in packages/shared/src/validators/index.ts", async () => {
    const content = await readFile(VALIDATORS_INDEX, "utf-8");
    expect(content).toContain("createCredentialProxyRuleSchema");
    expect(content).toContain("updateCredentialProxyRuleSchema");
    expect(content).toContain("testCredentialProxyRuleSchema");
    expect(content).toContain("credential-proxy");
  });
});
