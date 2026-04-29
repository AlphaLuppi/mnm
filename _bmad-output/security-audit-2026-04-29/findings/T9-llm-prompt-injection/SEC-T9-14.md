---
id: SEC-T9-14
severity: low
category: LLM09 - Overreliance / LLM08 - Excessive Agency
title: review-pass canonical gate relies solely on artifact data for review score — adversarial agent can self-certify any score
file: packages/gate-runner/canonical/review-pass.gate.ts:53-127
status: open
---

## Description

The `review-pass` gate evaluates whether a review score meets a minimum threshold. It reads the score exclusively from `ctx.artifact`:

```typescript
const candidates: unknown[] = [];
if (ctx.artifact !== undefined) candidates.push(ctx.artifact);
for (const prev of Object.values(ctx.step.previous_artifacts)) {
  candidates.push(prev);
}
```

The artifact is produced by the completing agent itself via `complete_governed_step`:
```typescript
tool("complete_governed_step", {
  input: z.object({
    run_id: z.string().uuid(),
    step_id: z.string().min(1),
    artifact: artifactInputSchema, // ← agent-controlled
  }),
```

An agent executing a "review step" can simply submit an artifact with:
```json
{
  "outputs": [],
  "data": {
    "review": { "score": 100, "report_path": "design.md" }
  }
}
```

…and the gate passes with a perfect score of 100, even if no actual review was performed. The gate has no way to verify that the `score` field reflects a genuine review.

This is an inherent limitation of self-attested gates — but it's particularly dangerous for compliance workflows where the review-pass gate is intended to enforce human or third-party review.

## Impact

- **Compliance bypass**: an agent can bypass quality gates by self-reporting favorable review scores
- **Trust degradation**: if review-pass gates are used to enforce security reviews (e.g., code review before deployment), malicious agents can self-certify any change as reviewed
- **Audit integrity**: gate results are stored in `gate_results` table and may be used for compliance reporting — falsified results appear authentic

## Reproduction

1. Agent runs a step intended to require code review
2. Instead of getting a real review, the agent calls `complete_governed_step` with:
   ```json
   {"artifact": {"outputs": [], "data": {"review": {"score": 100, "report_path": "design.md"}}}}
   ```
3. The `review-pass` gate evaluates `score: 100 >= min_score` → passes
4. The run proceeds to the next step as if a genuine review was completed

## Recommendation

1. **External verification**: the `getMergeRequestApprovals` helper already exists for this purpose — the `review-pass` gate should optionally call this helper to verify approvals against GitLab/GitHub rather than trusting the artifact score

2. **Signed reviews**: require review artifacts to include a cryptographic signature from the reviewing entity (user JWT or agent JWT) — the gate verifies the signature

3. **Separate reviewer identity**: add a `reviewer_id` field to the review artifact that must reference a user who did NOT initiate the step, verified server-side

4. **Documentation**: at minimum, document clearly in the canonical gate that `review-pass` is an honor-system gate and is NOT suitable for enforcing mandatory human reviews without additional verification

## References
- OWASP LLM Top 10 https://owasp.org/www-project-top-10-for-large-language-model-applications/ (LLM08, LLM09)
- CWE-345: Insufficient Verification of Data Authenticity
