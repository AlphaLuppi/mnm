/**
 * OBS-02: TraceDataProvider + Tree Building
 *
 * Provides a hierarchical tree of trace data:
 *   Phase group nodes (from silver phases)
 *     -> Observation nodes (with parent/child nesting)
 *       -> Gold annotations attached to phase nodes
 *
 * Tree is built ITERATIVELY (not recursive) for performance.
 * Exposes: roots (tree), nodeMap (O(1) lookup), flatList (for virtualization).
 */

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type {
  TraceDetail,
  TraceObservation,
  TracePhase,
  TraceGoldPhase,
} from "../api/traces";

// ─── Tree Node ───────────────────────────────────────────────────────────────

export interface TreeNode {
  id: string;
  type: "phase" | "observation";
  label: string;
  phaseType?: string; // COMPREHENSION, IMPLEMENTATION, etc.
  observation?: TraceObservation;
  phase?: TracePhase;
  goldPhase?: TraceGoldPhase;
  children: TreeNode[];
  depth: number;
  // Aggregated metrics
  totalDurationMs: number;
  totalCost: number;
  observationCount: number;
}

// ─── Context Value ───────────────────────────────────────────────────────────

export interface TraceDataContextValue {
  trace: TraceDetail | null;
  roots: TreeNode[];
  nodeMap: Map<string, TreeNode>;
  flatList: TreeNode[];
  isLoading: boolean;
}

const TraceDataContext = createContext<TraceDataContextValue | null>(null);

// ─── Tree Building (iterative) ──────────────────────────────────────────────

function flattenObservations(observations: TraceObservation[]): TraceObservation[] {
  const result: TraceObservation[] = [];
  const stack = [...observations].reverse(); // reverse so first item is processed first
  while (stack.length > 0) {
    const obs = stack.pop()!;
    result.push(obs);
    if (obs.children && obs.children.length > 0) {
      // Push children in reverse so they maintain order
      for (let i = obs.children.length - 1; i >= 0; i--) {
        stack.push(obs.children[i]);
      }
    }
  }
  return result;
}

function parseCost(cost: number | string | null | undefined): number {
  if (cost == null) return 0;
  if (typeof cost === "number") return cost;
  const parsed = parseFloat(cost);
  return isNaN(parsed) ? 0 : parsed;
}

function buildObservationNode(
  obs: TraceObservation,
  depth: number,
): TreeNode {
  return {
    id: obs.id,
    type: "observation",
    label: obs.name,
    observation: obs,
    children: [],
    depth,
    totalDurationMs: obs.durationMs ?? 0,
    totalCost: parseCost(obs.costUsd),
    observationCount: 1,
  };
}

/**
 * Build the tree iteratively:
 * 1. Create phase group nodes from silver phases
 * 2. Put observations under their phase by startIdx→endIdx range
 * 3. Handle parentObservationId for sub-trees within each phase
 * 4. Attach gold annotations to phase nodes
 * 5. Compute aggregated metrics bottom-up
 */
function buildTree(
  trace: TraceDetail,
): { roots: TreeNode[]; nodeMap: Map<string, TreeNode>; flatList: TreeNode[] } {
  const nodeMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  const allObservations = trace.observations ?? [];
  const flatObs = flattenObservations(allObservations);
  const phases = trace.phases ?? [];
  const gold = trace.gold;

  // Build gold phase lookup
  const goldPhaseByOrder = new Map<number, TraceGoldPhase>();
  if (gold?.phases) {
    for (const gp of gold.phases) {
      goldPhaseByOrder.set(gp.phaseOrder, gp);
    }
  }

  if (phases.length > 0) {
    // --- Phase-based tree ---
    for (const phase of phases) {
      const phaseId = `phase-${phase.order}`;
      const goldPhase = goldPhaseByOrder.get(phase.order);

      const phaseNode: TreeNode = {
        id: phaseId,
        type: "phase",
        label: phase.name || phase.type,
        phaseType: phase.type,
        phase,
        goldPhase,
        children: [],
        depth: 0,
        totalDurationMs: 0,
        totalCost: 0,
        observationCount: 0,
      };

      // Get observations in this phase's range
      const phaseObs = flatObs.slice(phase.startIdx, phase.endIdx + 1);

      // Build observation sub-tree within the phase
      // Use a map to track observation nodes for parent linkage
      const obsNodeMap = new Map<string, TreeNode>();

      // First pass: create all observation nodes
      for (const obs of phaseObs) {
        const obsNode = buildObservationNode(obs, 1);
        obsNodeMap.set(obs.id, obsNode);
        nodeMap.set(obs.id, obsNode);
      }

      // Second pass: link parent/child relationships
      for (const obs of phaseObs) {
        const obsNode = obsNodeMap.get(obs.id)!;
        if (obs.parentObservationId && obsNodeMap.has(obs.parentObservationId)) {
          const parentNode = obsNodeMap.get(obs.parentObservationId)!;
          obsNode.depth = parentNode.depth + 1;
          parentNode.children.push(obsNode);
        } else {
          // Top-level observation within this phase
          phaseNode.children.push(obsNode);
        }
      }

      // Aggregate metrics bottom-up (iterative post-order)
      // Process children first: traverse all observation nodes in reverse depth order
      const allPhaseObsNodes = Array.from(obsNodeMap.values());
      // Sort by depth descending so we process leaves first
      allPhaseObsNodes.sort((a, b) => b.depth - a.depth);

      for (const node of allPhaseObsNodes) {
        if (node.children.length > 0) {
          // Aggregate from children
          let childDuration = 0;
          let childCost = 0;
          let childCount = 0;
          for (const child of node.children) {
            childDuration += child.totalDurationMs;
            childCost += child.totalCost;
            childCount += child.observationCount;
          }
          // Use own duration if larger (children may overlap), otherwise sum
          node.totalDurationMs = Math.max(node.totalDurationMs, childDuration);
          node.totalCost += childCost;
          node.observationCount += childCount;
        }
      }

      // Aggregate phase metrics from direct children
      for (const child of phaseNode.children) {
        phaseNode.totalDurationMs += child.totalDurationMs;
        phaseNode.totalCost += child.totalCost;
        phaseNode.observationCount += child.observationCount;
      }

      nodeMap.set(phaseId, phaseNode);
      roots.push(phaseNode);
    }
  } else {
    // --- No phases: flat observation list ---
    for (const obs of flatObs) {
      const obsNode = buildObservationNode(obs, 0);
      nodeMap.set(obs.id, obsNode);
      roots.push(obsNode);
    }
  }

  // Build flat list (pre-order traversal, iterative)
  const flatList: TreeNode[] = [];
  const stack: TreeNode[] = [...roots].reverse();
  while (stack.length > 0) {
    const node = stack.pop()!;
    flatList.push(node);
    // Push children in reverse so first child is popped first
    for (let i = node.children.length - 1; i >= 0; i--) {
      stack.push(node.children[i]);
    }
  }

  return { roots, nodeMap, flatList };
}

// ─── Provider ────────────────────────────────────────────────────────────────

interface TraceDataProviderProps {
  trace: TraceDetail | null;
  isLoading: boolean;
  children: ReactNode;
}

export function TraceDataProvider({ trace, isLoading, children }: TraceDataProviderProps) {
  const { roots, nodeMap, flatList } = useMemo(() => {
    if (!trace) {
      return { roots: [], nodeMap: new Map<string, TreeNode>(), flatList: [] };
    }
    return buildTree(trace);
  }, [trace]);

  const value = useMemo<TraceDataContextValue>(
    () => ({ trace, roots, nodeMap, flatList, isLoading }),
    [trace, roots, nodeMap, flatList, isLoading],
  );

  return (
    <TraceDataContext.Provider value={value}>
      {children}
    </TraceDataContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useTraceData(): TraceDataContextValue {
  const ctx = useContext(TraceDataContext);
  if (!ctx) {
    throw new Error("useTraceData must be used within TraceDataProvider");
  }
  return ctx;
}
