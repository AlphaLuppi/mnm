/**
 * AiAssistantPanel tests — pure helper only (shouldAutoScroll).
 *
 * React Testing Library is not installed in this workspace; end-to-end
 * behaviour of the panel is covered by the manual QA checklist + the hook
 * tests in useAiAssistant.test.ts.
 */
import { describe, it, expect } from "vitest";
import { shouldAutoScroll } from "../AiAssistantPanel";

describe("shouldAutoScroll", () => {
  it("returns true when user is pinned at the very bottom", () => {
    expect(shouldAutoScroll(900, 1000, 100)).toBe(true);
  });

  it("returns true within the default threshold (60px) above the bottom", () => {
    // scrollTop=860, scrollHeight=1000, clientHeight=100 → gap=40 → within 60
    expect(shouldAutoScroll(860, 1000, 100)).toBe(true);
  });

  it("returns false when the user has scrolled far up", () => {
    // gap=300
    expect(shouldAutoScroll(600, 1000, 100)).toBe(false);
  });

  it("respects a custom threshold", () => {
    // gap=150, threshold=200 → true
    expect(shouldAutoScroll(750, 1000, 100, 200)).toBe(true);
    // gap=150, threshold=100 → false
    expect(shouldAutoScroll(750, 1000, 100, 100)).toBe(false);
  });

  it("handles an empty/zero-height viewport gracefully", () => {
    // No scroll to speak of — gap=0, definitely within threshold
    expect(shouldAutoScroll(0, 0, 0)).toBe(true);
  });
});
