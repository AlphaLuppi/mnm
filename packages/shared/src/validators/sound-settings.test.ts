import { describe, it, expect } from "vitest";
import { soundRefSchema, updateSoundSettingsSchema } from "./sound-settings.js";

describe("soundRefSchema", () => {
  it.each(["none", "builtin:chime", "asset:7b6b9c2e-0000-4000-8000-000000000000"])(
    "accepts %s",
    (ref) => expect(soundRefSchema.safeParse(ref).success).toBe(true),
  );

  it.each(["", "builtin:", "asset:not-a-uuid", "random", "builtin:bad id"])(
    "rejects %s",
    (ref) => expect(soundRefSchema.safeParse(ref).success).toBe(false),
  );
});

describe("updateSoundSettingsSchema", () => {
  it("accepts a partial patch", () => {
    expect(updateSoundSettingsSchema.safeParse({ volume: 50 }).success).toBe(true);
  });

  it("rejects volume out of range", () => {
    expect(updateSoundSettingsSchema.safeParse({ volume: 101 }).success).toBe(false);
    expect(updateSoundSettingsSchema.safeParse({ volume: -1 }).success).toBe(false);
  });

  it("accepts a full tones map", () => {
    const r = updateSoundSettingsSchema.safeParse({
      enabled: false,
      volume: 0,
      tones: { info: "none", success: "builtin:chime", warn: "none", error: "none" },
    });
    expect(r.success).toBe(true);
  });

  it("rejects an invalid tone ref", () => {
    expect(
      updateSoundSettingsSchema.safeParse({ tones: { info: "builtin:" } }).success,
    ).toBe(false);
  });
});
