// Factories — build (plain objects) and create (DB inserts) test entities
export {
  buildTestCompany,
  createTestCompany,
  type TestCompanyOverrides,
  buildTestUser,
  createTestUser,
  type TestUserOverrides,
  buildTestAgent,
  createTestAgent,
  type TestAgentOverrides,
  buildTestProject,
  createTestProject,
  type TestProjectOverrides,
  buildTestIssue,
  createTestIssue,
  type TestIssueOverrides,
  buildTestCompanyMembership,
  createTestCompanyMembership,
  type TestCompanyMembershipOverrides,
  buildTestProjectMembership,
  createTestProjectMembership,
  type TestProjectMembershipOverrides,
  buildTestPermissionGrant,
  createTestPermissionGrant,
  type TestPermissionGrantOverrides,
} from "./factories/index.js";

// Helpers — DB setup/teardown, E2E seeding, mock LLM
export {
  setupTestDb,
  teardownTestDb,
  cleanTestDb,
  seedE2eScenario,
  type E2eSeedResult,
  createMockLlmProvider,
  type MockLlmProvider,
} from "./helpers/index.js";
