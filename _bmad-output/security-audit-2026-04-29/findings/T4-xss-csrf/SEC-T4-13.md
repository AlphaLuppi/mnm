---
id: SEC-T4-13
severity: low
category: OWASP A03 / CWE-79 — Mermaid XSS risk (currently mitigated, fragile)
title: Mermaid diagram rendering uses dangerouslySetInnerHTML with DOMPurify SVG profile
file: ui/src/components/MarkdownBody.tsx:73-101
status: open
---

## Description

Mermaid diagrams in markdown are rendered by calling mermaid.render() and then displaying the SVG output via React's dangerouslySetInnerHTML:

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",   // Mermaid's built-in sanitization
      ...
    });
    const rendered = await mermaid.render(id, source);
    // MarkdownBody.tsx:101
    <div __html={DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true } })} />

Two defense layers are applied:
1. Mermaid securityLevel: "strict" — Mermaid's own sanitization.
2. DOMPurify with USE_PROFILES: { svg: true } — strips non-SVG elements and most event handlers.

Why this is still a low-risk concern:
- DOMPurify's SVG profile allows SVG elements like animate, foreignObject, use, and a[xlink:href]. The foreignObject element can contain HTML. Depending on the DOMPurify version, some of these may pass through.
- USE_PROFILES: { svg: true } does NOT enable svgFilters separately (good).
- FORCE_BODY and ALLOW_UNKNOWN_PROTOCOLS are not used (good).
- DOMPurify version is not pinned to a security patch level in package.json.

Mermaid source comes from user-authored markdown in issues/comments — a user crafting a mermaid block with a carefully constructed SVG injection could potentially bypass both layers if a DOMPurify vulnerability exists.

## Impact

- Low: Both Mermaid strict mode and DOMPurify SVG profile must be bypassed simultaneously. No known current exploits.
- If DOMPurify is not kept up to date, XSS via Mermaid diagrams becomes possible.

## Reproduction

1. Create an issue with a markdown mermaid block containing specially crafted SVG.
2. The server stores the markdown.
3. Any viewer of the issue renders the diagram.
4. A DOMPurify bypass would execute JS in the viewer's browser context.

## Recommendation

1. Pin DOMPurify version and subscribe to its security advisories.
2. Consider adding FORBID_TAGS: ["foreignObject", "use"] to the DOMPurify options.
3. Add CSP (SEC-T4-01) as defense-in-depth.
4. Consider rendering Mermaid in a sandboxed iframe.

## References

- DOMPurify SVG XSS research: https://research.securitum.com/mutation-based-xss-attacks/
- Mermaid Security docs: https://mermaid.js.org/config/configuration.html#securitylevel
