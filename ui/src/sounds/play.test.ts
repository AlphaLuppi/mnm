import { describe, it, expect } from "vitest";
import { resolveSoundUrl, shouldPlay } from "./play";
import type { SoundSettings } from "@mnm/shared";

const base: SoundSettings = {
  enabled: true,
  volume: 70,
  tones: { info: "none", success: "builtin:chime", warn: "none", error: "asset:abc" },
};

describe("shouldPlay", () => {
  it("false when globally disabled", () => {
    expect(shouldPlay({ ...base, enabled: false }, "success")).toBe(false);
  });
  it("false when tone ref is none", () => {
    expect(shouldPlay(base, "info")).toBe(false);
  });
  it("true when enabled and tone has a sound", () => {
    expect(shouldPlay(base, "success")).toBe(true);
  });
});

describe("resolveSoundUrl", () => {
  const ctx = {
    companyId: "c1",
    builtinUrl: (f: string) => `/sounds/${f}`,
    builtins: [{ id: "chime", label: "Chime", file: "chime.mp3" }],
  };
  it("resolves a builtin ref to its file url", () => {
    expect(resolveSoundUrl("builtin:chime", ctx)).toBe("/sounds/chime.mp3");
  });
  it("resolves an asset ref to the asset content endpoint", () => {
    expect(resolveSoundUrl("asset:abc", ctx)).toBe("/api/companies/c1/assets/abc/content");
  });
  it("returns null for none or unknown builtin (graceful fallback)", () => {
    expect(resolveSoundUrl("none", ctx)).toBeNull();
    expect(resolveSoundUrl("builtin:ghost", ctx)).toBeNull();
  });
});
