# Governed Workflows — Documentation

DAG de steps et gates versionnés dans Git, exécutés par le `gate-runner`, observés via l'UI Workflow Studio et les outils MCP. Cette section regroupe les guides opérationnels.

## Documents

- [`local-testing.md`](local-testing.md) — Hello-world local pour tester Governed Workflows (embedded Postgres, mode `local_trusted`).
- [`scenarios.md`](scenarios.md) — Scénarios d'usage : hello-world, branching, artifact chaining, parallel gates, LLM-as-judge.
- [`handoff-artifacts.md`](handoff-artifacts.md) — Schéma des artifacts échangés entre steps + user guide.
- [`oauth-setup.md`](oauth-setup.md) — Setup OAuth + GitLab OIDC (consolidation OAuth setup + GitLab setup).
- [`connectors.md`](connectors.md) — Hub Connectors Platform (admin config, user self-service, getUserToken pour les hooks/agents).

## Voir aussi

Plans et specs Superpowers liés (sous `docs/superpowers/`) :

- [`../superpowers/plans/2026-04-21-governed-workflows-T1-package.md`](../superpowers/plans/2026-04-21-governed-workflows-T1-package.md) — Package skeleton.
- [`../superpowers/plans/2026-04-21-governed-workflows-T2-migrations.md`](../superpowers/plans/2026-04-21-governed-workflows-T2-migrations.md) — DB migrations.
- [`../superpowers/plans/2026-04-21-governed-workflows-T3-git-provider.md`](../superpowers/plans/2026-04-21-governed-workflows-T3-git-provider.md) — Git provider abstraction.
- [`../superpowers/plans/2026-04-21-governed-workflows-T4-gate-runner.md`](../superpowers/plans/2026-04-21-governed-workflows-T4-gate-runner.md) — Gate runner core.
- [`../superpowers/plans/2026-04-21-governed-workflows-T5-mcp-tools.md`](../superpowers/plans/2026-04-21-governed-workflows-T5-mcp-tools.md) — MCP tools.
- [`../superpowers/plans/2026-04-24-governed-workflows-ui.md`](../superpowers/plans/2026-04-24-governed-workflows-ui.md) — UI cockpit (U1–U8).
- [`../superpowers/plans/2026-04-24-workflow-studio.md`](../superpowers/plans/2026-04-24-workflow-studio.md) — Workflow Studio (multi-file editor + AI Assistant).
- [`../superpowers/plans/2026-04-27-artifact-persistence.md`](../superpowers/plans/2026-04-27-artifact-persistence.md) — Artifact persistence layer.
- [`../superpowers/plans/2026-04-27-cancel-governed-workflow-runs.md`](../superpowers/plans/2026-04-27-cancel-governed-workflow-runs.md) — Cancel/reactivate cycle.
