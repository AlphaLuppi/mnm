/**
 * CancelRunDialog tests — pure validator only.
 *
 * The component is a thin shell over the Dialog/Button/Textarea primitives
 * plus the `useCancelRun` mutation, which is already covered by:
 *   - ui/src/hooks/__tests__/* (mutation hooks)
 *   - the integration tests touching governed-workflows-ui routes
 *
 * React Testing Library is not installed in this workspace (see
 * ui/src/components/workflow-studio/__tests__/AiAssistantPanel.test.tsx for
 * the established convention). We exercise the only domain logic the dialog
 * itself owns: the reason validity rule.
 */
import { describe, it, expect } from "vitest";
import {
  isCancelReasonValid,
  MIN_CANCEL_REASON_LENGTH,
} from "../CancelRunDialog";

describe("isCancelReasonValid", () => {
  it("rejects an empty string", () => {
    expect(isCancelReasonValid("")).toBe(false);
  });

  it(`rejects strings under ${MIN_CANCEL_REASON_LENGTH} chars (incl. whitespace-only)`, () => {
    expect(isCancelReasonValid("oops")).toBe(false); // 4 chars
    expect(isCancelReasonValid("    ")).toBe(false); // whitespace-only, trims to 0
    expect(isCancelReasonValid("  ab  ")).toBe(false); // trims to 2
  });

  it(`accepts strings with >= ${MIN_CANCEL_REASON_LENGTH} trimmed chars`, () => {
    expect(isCancelReasonValid("erreur")).toBe(true); // 6
    expect(isCancelReasonValid("12345")).toBe(true); // exactly the boundary
    expect(isCancelReasonValid("   bonne raison   ")).toBe(true); // trims fine
  });
});
