---
id: SEC-T4-10
severity: medium
category: OWASP A05 / CWE-434 — Unrestricted File Upload (document/folder uploads accept arbitrary MIME types)
title: Folder/document upload endpoint accepts any MIME type — no content-type allowlist
file: server/src/routes/folders.ts:361, server/src/routes/documents.ts:71
status: open
---

## Description

The issue attachment endpoint (`/companies/:companyId/issues/:issueId/attachments`) and the asset endpoint (`/companies/:companyId/assets`) both have explicit MIME allowlists:

```typescript
// issues.ts:35-41 (ALLOWED_ATTACHMENT_CONTENT_TYPES)
const ALLOWED_ATTACHMENT_CONTENT_TYPES = new Set([
  "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif",
]);

// assets.ts:11-17 (ALLOWED_IMAGE_CONTENT_TYPES) — same set
```

**However**, the folder/workspace document upload (`folders.ts:361`) and the generic document upload (`documents.ts:71`) accept **any MIME type**:

```typescript
// folders.ts:361
const mimeType = file.mimetype || "application/octet-stream";
// No allowlist check — mimeType is accepted as-is

// documents.ts:71
const mimeType = file.mimetype || "application/octet-stream";
// No allowlist check either
```

This allows uploading:
- `text/html` files — which could be served inline (see documents download: `Content-Disposition: attachment` is used but the document viewer categorizes `text/*` as "text" and renders it inline in the browser via fetch+display).
- `image/svg+xml` files — SVG can contain `<script>` tags. If served with `Content-Type: image/svg+xml` and opened in a new tab (or rendered in an `<img>` tag — though `<img>` generally blocks script execution), it could execute JavaScript.
- `application/javascript` — uploaded JS files.

The `document-viewer.tsx` component categorizes MIME types and renders them accordingly. `image/svg+xml` would match `mimeType.startsWith("image/")` → rendered via `<img src={url}>` (relatively safe for script execution, but SVG with event handlers like `onload=alert(1)` in inline SVG context could matter).

**Stored file serving:** The document download route (`documents.ts:209`) uses `Content-Disposition: attachment` — which forces download rather than inline display, reducing immediate XSS risk. The asset serve route uses `Content-Disposition: inline` which is higher risk.

## Impact

- Upload of SVG with embedded scripts — if served inline or opened in a new tab from the app's origin, scripts execute.
- Upload of HTML files — potential phishing pages hosted on the app's origin.
- Stored XSS if any viewer renders the SVG/HTML content.

## Recommendation

1. Extend `ALLOWED_ATTACHMENT_CONTENT_TYPES` to all upload endpoints, or create a shared utility:
   ```typescript
   const ALLOWED_DOCUMENT_TYPES = new Set([
     "application/pdf",
     "text/plain", "text/markdown", "text/csv",
     "application/json",
     "image/png", "image/jpeg", "image/webp", "image/gif",
     // explicitly EXCLUDE: image/svg+xml, text/html, application/javascript
   ]);
   ```
2. If SVG support is required, serve SVGs with `Content-Type: image/svg+xml` and a strict CSP (`Content-Security-Policy: sandbox`) on the serving route.
3. Ensure `Content-Disposition: attachment` (not `inline`) on all document download routes.
4. Server-side MIME sniffing using `file-type` library (reads magic bytes) — do not rely solely on client-provided `Content-Type` from multer, which trusts the `Content-Type` header sent by the browser.

## References

- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [CWE-434: Unrestricted Upload of File with Dangerous Type](https://cwe.mitre.org/data/definitions/434.html)
