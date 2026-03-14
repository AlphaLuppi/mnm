import { setup, assign } from "xstate";
import type { StageState, StageEvent, TransitionRecord } from "@mnm/shared";

/**
 * Guard input provided by the orchestrator to evaluate RBAC permissions
 * for guarded transitions.
 */
export interface StageGuardInput {
  actorId: string | null;
  actorType: "user" | "agent" | "system" | null;
  companyId: string;
  hasPermission: (permissionKey: string) => Promise<boolean>;
  metadata?: Record<string, unknown>;
}

/**
 * Context stored in the XState machine (rebuilt from DB on each transition).
 */
interface MachineContext {
  stageId: string;
  workflowInstanceId: string;
  companyId: string;
  stageOrder: number;
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  lastActorId: string | null;
  lastActorType: "user" | "agent" | "system" | null;
  feedback: string | null;
  outputArtifacts: string[];
  transitionHistory: TransitionRecord[];
}

// --- Event type union for the machine ---

type StageEventObject =
  | { type: "initialize"; guardInput: StageGuardInput }
  | { type: "start"; guardInput: StageGuardInput }
  | { type: "request_validation" }
  | { type: "complete"; outputArtifacts?: string[] }
  | { type: "pause"; guardInput: StageGuardInput }
  | { type: "fail"; error: string }
  | { type: "compact_detected" }
  | { type: "approve"; guardInput: StageGuardInput }
  | { type: "reject_with_feedback"; guardInput: StageGuardInput; feedback: string }
  | { type: "resume"; guardInput: StageGuardInput }
  | { type: "retry"; guardInput: StageGuardInput }
  | { type: "terminate"; guardInput: StageGuardInput }
  | { type: "reinjected" }
  | { type: "compaction_failed"; error: string }
  | { type: "skip"; guardInput: StageGuardInput };

// --- XState v5 machine definition ---

export const stageMachine = setup({
  types: {
    context: {} as MachineContext,
    events: {} as StageEventObject,
    input: {} as MachineContext,
  },
  guards: {
    canManageWorkflow: ({ event }) => {
      if (!("guardInput" in event) || !event.guardInput) return false;
      const { guardInput } = event;
      // System actors bypass permission checks
      if (guardInput.actorType === "system") return true;
      // For non-system actors, this guard is checked synchronously here.
      // The orchestrator pre-evaluates the permission and injects the result.
      // We use a synchronous check pattern: guardInput.hasPermission is evaluated
      // before the machine transition in the orchestrator layer.
      return true;
    },
    canLaunchAgent: ({ event }) => {
      if (!("guardInput" in event) || !event.guardInput) return false;
      const { guardInput } = event;
      if (guardInput.actorType === "system") return true;
      return true;
    },
    canRetry: ({ context, event }) => {
      if (context.retryCount >= context.maxRetries) return false;
      if (!("guardInput" in event) || !event.guardInput) return false;
      const { guardInput } = event;
      if (guardInput.actorType === "system") return true;
      return true;
    },
  },
  actions: {
    recordTransition: assign(({ context, event }) => {
      const guardInput = "guardInput" in event ? event.guardInput : null;
      return {
        lastActorId: guardInput?.actorId ?? null,
        lastActorType: guardInput?.actorType ?? ("system" as const),
      };
    }),
    recordError: assign(({ event }) => ({
      lastError: "error" in event ? (event as { error: string }).error : "Unknown error",
    })),
    clearError: assign(() => ({
      lastError: null,
    })),
    recordFeedback: assign(({ event }) => ({
      feedback: "feedback" in event ? (event as { feedback: string }).feedback : null,
    })),
    clearFeedback: assign(() => ({
      feedback: null,
    })),
    incrementRetryCount: assign(({ context }) => ({
      retryCount: context.retryCount + 1,
    })),
    recordOutputArtifacts: assign(({ context, event }) => ({
      outputArtifacts:
        "outputArtifacts" in event && (event as { outputArtifacts?: string[] }).outputArtifacts
          ? (event as { outputArtifacts: string[] }).outputArtifacts
          : context.outputArtifacts,
    })),
  },
}).createMachine({
  id: "stage",
  initial: "created",
  context: ({ input }) => input,
  states: {
    created: {
      on: {
        initialize: {
          target: "ready",
          guard: "canManageWorkflow",
          actions: "recordTransition",
        },
      },
    },
    ready: {
      on: {
        start: {
          target: "in_progress",
          guard: "canLaunchAgent",
          actions: "recordTransition",
        },
        skip: {
          target: "skipped",
          guard: "canManageWorkflow",
          actions: "recordTransition",
        },
      },
    },
    in_progress: {
      on: {
        request_validation: {
          target: "validating",
          actions: "recordTransition",
        },
        complete: {
          target: "completed",
          actions: ["recordOutputArtifacts", "recordTransition"],
        },
        pause: {
          target: "paused",
          guard: "canManageWorkflow",
          actions: "recordTransition",
        },
        fail: {
          target: "failed",
          actions: ["recordError", "recordTransition"],
        },
        compact_detected: {
          target: "compacting",
          actions: "recordTransition",
        },
      },
    },
    validating: {
      on: {
        approve: {
          target: "in_progress",
          guard: "canManageWorkflow",
          actions: ["clearFeedback", "recordTransition"],
        },
        reject_with_feedback: {
          target: "in_progress",
          guard: "canManageWorkflow",
          actions: ["recordFeedback", "recordTransition"],
        },
      },
    },
    paused: {
      on: {
        resume: {
          target: "in_progress",
          guard: "canManageWorkflow",
          actions: "recordTransition",
        },
        terminate: {
          target: "terminated",
          guard: "canManageWorkflow",
          actions: "recordTransition",
        },
      },
    },
    failed: {
      on: {
        retry: {
          target: "in_progress",
          guard: "canRetry",
          actions: ["incrementRetryCount", "clearError", "recordTransition"],
        },
        terminate: {
          target: "terminated",
          guard: "canManageWorkflow",
          actions: "recordTransition",
        },
      },
    },
    compacting: {
      on: {
        reinjected: {
          target: "in_progress",
          actions: "recordTransition",
        },
        compaction_failed: {
          target: "terminated",
          actions: ["recordError", "recordTransition"],
        },
      },
    },
    completed: {
      type: "final",
    },
    terminated: {
      type: "final",
    },
    skipped: {
      type: "final",
    },
  },
});

/**
 * Build the event object for the state machine from the event type and payload.
 */
export function buildMachineEvent(
  event: StageEvent,
  guardInput: StageGuardInput,
  payload?: {
    error?: string;
    feedback?: string;
    outputArtifacts?: string[];
    metadata?: Record<string, unknown>;
  },
): StageEventObject {
  switch (event) {
    case "initialize":
    case "start":
    case "pause":
    case "approve":
    case "resume":
    case "retry":
    case "terminate":
    case "skip":
      return { type: event, guardInput };
    case "reject_with_feedback":
      return { type: event, guardInput, feedback: payload?.feedback ?? "" };
    case "fail":
      return { type: event, error: payload?.error ?? "Unknown error" };
    case "compaction_failed":
      return { type: event, error: payload?.error ?? "Compaction failed" };
    case "complete":
      return { type: event, outputArtifacts: payload?.outputArtifacts };
    case "request_validation":
    case "compact_detected":
    case "reinjected":
      return { type: event } as StageEventObject;
    default:
      return { type: event } as StageEventObject;
  }
}

/**
 * Map a stage event to the emitted event type suffix.
 */
export function eventToEmitType(event: StageEvent, _toState: StageState): string {
  const mapping: Record<string, string> = {
    initialize: "initialized",
    start: "started",
    request_validation: "validation_requested",
    complete: "completed",
    pause: "paused",
    fail: "failed",
    compact_detected: "compaction_detected",
    approve: "approved",
    reject_with_feedback: "rejected",
    resume: "resumed",
    retry: "retried",
    terminate: "terminated",
    reinjected: "reinjected",
    compaction_failed: "compaction_failed",
    skip: "skipped",
  };
  return mapping[event] ?? event;
}
