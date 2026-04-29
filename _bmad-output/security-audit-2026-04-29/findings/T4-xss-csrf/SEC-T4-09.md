---
id: SEC-T4-09
severity: medium
category: OWASP A03 / CWE-79 — XSS via linkified console output (PodConsole)
title: PodConsole linkifyText() renders command output URLs as <a href> without any validation
file: ui/src/components/workspace/PodConsole.tsx:27-42
status: open
---

## Description

The `PodConsole` component renders sandbox command output by linkifying URLs found in the text:

```tsx
function linkifyText(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      urlRegex.lastIndex = 0;
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" ...>
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
```

The regex `/(https?:\/\/[^\s]+)/g` matches strings starting with `http://` or `https://`. The matched string is then placed directly in `href={part}` and as the link text `{part}`.

**Attack vector:** The sandbox executes commands and returns their stdout/stderr. A command output could include constructed URLs:
1. An agent or malicious script running in the sandbox outputs a URL ending in `"><img src=x onerror=alert(1)>` — this is passed through React's JSX system which escapes HTML in text nodes (`{part}` is text-safe), but the `href=` attribute assignment could be exploitable.

Actually: since `href={part}` goes through React's JSX engine, React will HTML-encode the attribute value — **the href itself is not directly vulnerable to attribute injection**. However, the URL could be a `javascript:` URL if the regex allowed it — but since the regex requires `https?://`, pure `javascript:` is blocked.

**Real risk:** The `rel="noopener noreferrer"` is present, which prevents opener access. But: users may be tricked by visually spoofed URLs in command output (e.g., `https://mnm.example.com@evil.com/...`) — the full URL including the potentially misleading `@evil.com` host is displayed verbatim as clickable text. While this is not XSS, it is a potential phishing vector via command output injection in an agent sandbox.

Additionally, the regex split approach can produce unexpected results with overlapping URL captures. The `urlRegex.lastIndex = 0` reset inside the map loop is necessary (correctly applied here) but fragile.

## Impact

- Medium: URLs from sandbox command output are rendered as clickable links with the full (potentially misleading) URL as display text.
- If a future change widens the regex to include other schemes or the part is somehow rendered as HTML, XSS becomes possible.

## Recommendation

1. Truncate displayed URL text to a reasonable length (e.g., 80 chars) while keeping full href.
2. Show a visual indicator (domain name + "...") rather than the full URL to prevent misleading display.
3. Add documentation that this function must never accept user-controlled scheme prefixes beyond `https?://`.

## References

- [CWE-79](https://cwe.mitre.org/data/definitions/79.html)
- [Misleading URL Display / Homograph Attacks](https://owasp.org/www-community/attacks/Homograph_attack)
