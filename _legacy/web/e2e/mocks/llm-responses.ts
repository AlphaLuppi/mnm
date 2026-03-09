/**
 * Mock LLM API responses for E2E tests.
 * Used to intercept calls to Claude API and return deterministic responses.
 */

export const mockDriftAnalysis = {
  id: "msg_mock_drift",
  type: "message",
  role: "assistant",
  content: [
    {
      type: "text",
      text: JSON.stringify({
        hasDrift: true,
        severity: "medium",
        summary: "Implementation diverges from spec in error handling",
        details: [
          {
            section: "Error Handling",
            specRequirement: "All errors must return structured JSON",
            codeImplementation: "Some errors return plain text",
            severity: "medium",
          },
        ],
      }),
    },
  ],
  model: "claude-sonnet-4-20250514",
  stop_reason: "end_turn",
};

export const mockDiscoveryClassification = {
  id: "msg_mock_discovery",
  type: "message",
  role: "assistant",
  content: [
    {
      type: "text",
      text: JSON.stringify({
        specs: [
          {
            path: "_bmad-output/planning-artifacts/prd.md",
            type: "prd",
            title: "Product Requirements Document",
          },
          {
            path: "_bmad-output/planning-artifacts/architecture.md",
            type: "architecture",
            title: "Architecture Document",
          },
        ],
        workflows: [
          {
            path: "_bmad/bmm/workflows/test-workflow/workflow.md",
            name: "Test Workflow",
            steps: 5,
          },
        ],
        agents: [
          { name: "analyst", role: "Business Analyst" },
          { name: "developer", role: "Developer" },
          { name: "reviewer", role: "Code Reviewer" },
        ],
      }),
    },
  ],
  model: "claude-sonnet-4-20250514",
  stop_reason: "end_turn",
};

export const mockCrossDocDrift = {
  id: "msg_mock_crossdoc",
  type: "message",
  role: "assistant",
  content: [
    {
      type: "text",
      text: JSON.stringify({
        conflicts: [
          {
            docA: "prd.md",
            docB: "architecture.md",
            section: "Authentication",
            description: "PRD specifies OAuth but architecture describes session-based auth",
            severity: "high",
          },
        ],
      }),
    },
  ],
  model: "claude-sonnet-4-20250514",
  stop_reason: "end_turn",
};
