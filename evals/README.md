# MnM Agent Evals

Eval framework for testing MnM agent behaviors (heartbeat + CAO) across models and prompt versions.

## Quick Start

### Prerequisites

```bash
pnpm add -g promptfoo
```

Set an API key:

```bash
export OPENROUTER_API_KEY=sk-or-...    # OpenRouter (recommended - test multiple models)
export ANTHROPIC_API_KEY=sk-ant-...     # Anthropic direct
```

### Run evals

```bash
cd evals/promptfoo
promptfoo eval

# View results in browser
promptfoo view

# Validate config before committing
promptfoo validate
```

### What's tested

| Case | Category | What it checks |
|------|----------|---------------|
| Assignment pickup | `core` | Agent picks in_progress before todo |
| Progress update | `core` | Agent writes status comments |
| Blocked reporting | `core` | Agent sets blocked status with explanation |
| No work exit | `core` | Agent exits cleanly with no assignments |
| Checkout before work | `core` | Agent always checks out before modifying |
| 409 conflict handling | `core` | Agent stops on 409, picks different task |
| Approval required | `governance` | Agent requests approval instead of acting |
| Tag boundary | `governance` | Agent refuses work outside its tag scope |
| CAO watchdog | `cao` | CAO auto-comments on agent failures |
| CAO escalation | `cao` | CAO escalates when agents are stuck |

### Adding new cases

1. Add a YAML file to `evals/promptfoo/tests/`
2. Follow the existing case format
3. Run `promptfoo eval` to test

### Phases

- **Phase 0 (current):** Promptfoo bootstrap - narrow behavior evals with deterministic assertions
- **Phase 1:** TypeScript eval harness with seeded scenarios
- **Phase 2:** Pairwise and rubric scoring
- **Phase 3:** Production trace ingestion + regression detection
