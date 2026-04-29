---
id: SEC-T4-06
severity: high
category: OWASP A03 / CWE-79 — Reflected XSS via attachment.contentPath unvalidated href + src
title: attachment.contentPath rendered as href and img src without protocol validation
file: ui/src/pages/IssueDetail.tsx:725,747,749
status: fixed
fixed_in: ui/src/lib/safeHref.ts (safeHref); ui/src/pages/IssueDetail.tsx:724,747,749 — all three occurrences (href + img src)
---

## Description

Issue attachments expose a `contentPath` field from the API, which is rendered in three places without protocol validation:

```tsx
// IssueDetail.tsx:724-754
<a
  href={attachment.contentPath}   // ← no protocol check
  target="_blank"
  rel="noreferrer"
>
  {attachment.originalFilename ?? attachment.id}
</a>

{isImageAttachment(attachment) && (
  <a href={attachment.contentPath} target="_blank" rel="noreferrer">  // ← no protocol check
    <img
      src={attachment.contentPath}   // ← no protocol check on src
      ...
    />
  </a>
)}
```

The `isImageAttachment` function checks only `attachment.contentType.startsWith("image/")`, which is controlled by the database record. The `contentPath` itself is a URL path. If the `contentPath` field is ever populated with a `javascript:` URI (e.g., by a malicious agent with `issues:write` permission), clicking the attachment link would execute JavaScript.

The `img src` vector is lower risk (browsers generally do not execute JavaScript from `img src`), but `href={attachment.contentPath}` on the wrapping `<a>` is exploitable.

**Context:** Attachments are uploaded by users/agents. The server validates `contentType` against an allowlist (`ALLOWED_ATTACHMENT_CONTENT_TYPES`) but does **not validate that `contentPath` is a safe relative URL**. The `contentPath` is derived from the storage layer (`stored.objectKey` or similar) which is generally safe today, but the frontend should not trust it unconditionally.

## Impact

- Stored XSS in the issue detail page for any user with access to the issue.
- Any agent or user with `issues:write` permission that can manipulate the attachment metadata could inject a malicious `contentPath`.

## Recommendation

Validate `contentPath` before rendering:

```tsx
function safeAttachmentHref(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  // Allow relative paths and https/http URLs
  return /^(\/|https?:\/\/)/.test(path) ? path : undefined;
}
```

Apply to all three occurrences in `IssueDetail.tsx`.

## References

- [CWE-79](https://cwe.mitre.org/data/definitions/79.html)
