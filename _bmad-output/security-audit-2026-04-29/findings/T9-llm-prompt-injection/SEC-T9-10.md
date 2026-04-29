---
id: SEC-T9-10
severity: medium
category: LLM01 - Prompt Injection (Indirect) / LLM06 - Sensitive Information Disclosure
title: Gold enrichment uses combined system+user prompt in claude -p fallback — clear-text injection via single string argument
file: server/src/services/gold-trace-enrichment.ts:205-238
status: open
---

## Description

The `callClaudeCli` fallback function combines the system prompt and user message into a **single string** passed to `claude -p`:

```typescript
async function callClaudeCli(systemPrompt: string, userMessage: string) {
  const combinedPrompt = `${systemPrompt}\n\n---\n\nINPUT DATA:\n\n${userMessage}\n\nIMPORTANT: Respond with ONLY valid JSON...`;
  
  const { stdout } = await execFileAsync(
    "claude",
    ["-p", combinedPrompt, "--output-format", "text", "--model", "haiku"],
    { ... }
  );
}
```

The separator `\n\n---\n\n` is trivially bypassable. Any observation content containing `\n\n---\n\nSYSTEM PROMPT:` effectively prepends to the "system" section of the combined prompt. Unlike the Anthropic Messages API (which has separate `system` and `messages` parameters), `claude -p` with a single string argument has no hard boundary between system instructions and user data.

Additionally, `claude -p` is invoked with the **entire prompt as a command-line argument**. On some systems, argument lists are visible via `ps aux`, `/proc/*/cmdline` — any process with read access to procfs can read the full prompt including company-specific enrichment instructions stored in `gold_prompts`.

## Impact

- **System prompt extraction via procfs**: on Linux, `cat /proc/$(pgrep -f "claude -p")/cmdline | tr '\0' ' '` reveals the full prompt including gold_prompts instructions → information disclosure
- **Injection bypass via separator**: trace observations containing `\n\n---\n\n` followed by instructions can confuse the prompt boundary (though `claude -p` may handle this via its own parsing)
- **Business logic leakage**: the `gold_prompts` table stores per-company customized analysis instructions (SLA criteria, agent-specific scoring rubrics) that operators may consider confidential

## Reproduction

```bash
# On the server host, while a gold enrichment is running:
ps aux | grep "claude -p" | head -5
# OR
cat /proc/$(pgrep -f "claude.*haiku")/cmdline 2>/dev/null | strings
# → reveals the full gold_prompts system prompt in plaintext
```

## Recommendation

1. **Use `--system-prompt` flag if available**: pass the system prompt via a dedicated flag rather than concatenating into the user message
2. **Pass prompt via stdin**: instead of `-p combinedPrompt`, write the prompt to a temp file and use `--file /path/to/prompt.txt`, keeping it out of the process argument list:
   ```typescript
   const tmpFile = await writeToTempFile(combinedPrompt);
   await execFileAsync("claude", ["--file", tmpFile, "--output-format", "text", "--model", "haiku"]);
   await fs.unlink(tmpFile);
   ```
3. **Prefer the API over CLI**: use the direct Anthropic Messages API (`MNM_LLM_SUMMARY_ENDPOINT`) which has proper system/user separation, rather than the `claude -p` fallback
4. **Scrub observations before combining**: when using the CLI fallback, strip newline sequences that could confuse the separator

## References
- OWASP LLM Top 10 https://owasp.org/www-project-top-10-for-large-language-model-applications/ (LLM01, LLM06)
- CWE-214: Invocation of Process Using Visible Sensitive Information
