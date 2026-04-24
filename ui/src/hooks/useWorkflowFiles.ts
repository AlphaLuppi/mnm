/**
 * useWorkflowFiles (U13.7) — orchestrates the Workflow Studio's multi-file
 * editor state on top of the REST endpoints added in U13.3/U13.4.
 *
 * Responsibilities:
 *  - Fetch the file tree (listFiles) for the current company + workflow.
 *  - Lazily fetch file contents when a tab is opened for the first time
 *    (via queryClient.fetchQuery so cache is warm on revisit).
 *  - Track per-file buffers (`content`, `originalContent`, `dirty`, optional
 *    `deleted`) so the editor can surface dirty markers + discard/save.
 *  - Batch-commit all dirty buffers in a single atomic REST call
 *    (`batchCommitFiles`) and re-seed state from the fresh tree.
 *
 * The hook exposes a reducer-shaped API so the page (U13.8) stays lean —
 * all state transitions live here. The pure helper
 * `computeChangesFromFiles` is exported for unit testing without needing a
 * React renderer.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  governedWorkflowsApi,
  type TreeEntry,
  type WorkflowFileChange,
  type BatchCommitResult,
} from "@/api/governed-workflows";
import { queryKeys } from "@/lib/queryKeys";

/** Per-file buffer shape. `deleted` is a tombstone flag — it counts as dirty. */
export interface FileBuffer {
  content: string;
  originalContent: string;
  dirty: boolean;
  deleted?: boolean;
}

export interface UseWorkflowFilesResult {
  tree: TreeEntry[] | undefined;
  files: Record<string, FileBuffer>;
  activePath: string | null;
  setActivePath: (p: string) => void;
  editFile: (path: string, newContent: string) => void;
  addFile: (path: string, initialContent: string) => void;
  deleteFile: (path: string) => void;
  discardFile: (path: string) => void;
  discardAll: () => void;
  dirtyCount: number;
  dirtyPaths: Set<string>;
  save: (commitMessage: string) => Promise<BatchCommitResult>;
  isLoadingTree: boolean;
  treeError: Error | null;
  isSaving: boolean;
  saveError: Error | null;
}

export interface UseWorkflowFilesArgs {
  companyId: string;
  name: string;
  ref?: string;
}

/**
 * Pure helper: derive the `WorkflowFileChange[]` payload for batchCommitFiles
 * from a files map. Exported so it can be unit-tested without React.
 *
 * Rules:
 *  - `deleted: true` → emit `{path, delete: true}` (even if originalContent was "")
 *  - Brand-new file (originalContent === "") that isn't deleted → `{path, content}`
 *  - Modified existing file (dirty === true, not deleted) → `{path, content}`
 *  - Clean files are skipped.
 *
 * New-and-then-deleted files should have already been pruned by discardFile —
 * but if they somehow reach here, we still emit the delete, which the server
 * will reject cleanly rather than silently corrupt state.
 */
export function computeChangesFromFiles(
  files: Record<string, FileBuffer>,
): WorkflowFileChange[] {
  const changes: WorkflowFileChange[] = [];
  for (const [path, buf] of Object.entries(files)) {
    if (buf.deleted) {
      changes.push({ path, delete: true });
      continue;
    }
    if (!buf.dirty) continue;
    changes.push({ path, content: buf.content });
  }
  return changes;
}

export function useWorkflowFiles(args: UseWorkflowFilesArgs): UseWorkflowFilesResult {
  const { companyId, name, ref } = args;
  const qc = useQueryClient();

  const treeQuery = useQuery({
    queryKey: queryKeys.governedWorkflows.files(companyId, name, ref),
    queryFn: () => governedWorkflowsApi.listFiles(companyId, name, { ref }),
    enabled: !!companyId && !!name,
  });

  const [files, setFiles] = useState<Record<string, FileBuffer>>({});
  const [activePath, setActivePathState] = useState<string | null>(null);

  // Only seed the default activePath the first time the tree resolves, so we
  // don't clobber a user's later selection after a refetch.
  const defaultSeededRef = useRef<boolean>(false);

  useEffect(() => {
    if (defaultSeededRef.current) return;
    const tree = treeQuery.data?.tree;
    if (!tree || tree.length === 0) return;
    const blobs = tree.filter((e) => e.type === "blob");
    if (blobs.length === 0) return;

    // Prefer workflow.json if present, else first blob alphabetically.
    const hasWorkflowJson = blobs.some((b) => b.path === "workflow.json");
    const initialPath = hasWorkflowJson
      ? "workflow.json"
      : [...blobs].sort((a, b) => a.path.localeCompare(b.path))[0].path;

    defaultSeededRef.current = true;
    void loadAndSetActive(initialPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeQuery.data]);

  /**
   * Fetch a file's content via queryClient.fetchQuery (cache-aware) and seed
   * it into the local files map before flipping activePath. If the file is
   * already in state (dirty or otherwise), skip the fetch and just switch.
   */
  const loadAndSetActive = useCallback(
    async (path: string) => {
      if (files[path]) {
        setActivePathState(path);
        return;
      }
      try {
        const result = await qc.fetchQuery({
          queryKey: queryKeys.governedWorkflows.file(companyId, name, path, ref),
          queryFn: () => governedWorkflowsApi.getFile(companyId, name, path, { ref }),
        });
        setFiles((prev) =>
          prev[path]
            ? prev
            : {
                ...prev,
                [path]: {
                  content: result.content,
                  originalContent: result.content,
                  dirty: false,
                },
              },
        );
        setActivePathState(path);
      } catch {
        // Swallow — the error is already attached to the query cache and the
        // page can surface it via a separate useQuery if needed. Keep active
        // path unchanged so the editor doesn't flash empty.
      }
    },
    [files, qc, companyId, name, ref],
  );

  const setActivePath = useCallback(
    (p: string) => {
      void loadAndSetActive(p);
    },
    [loadAndSetActive],
  );

  const editFile = useCallback((path: string, newContent: string) => {
    setFiles((prev) => {
      const existing = prev[path];
      if (!existing) return prev;
      const dirty = existing.deleted ? true : newContent !== existing.originalContent;
      return {
        ...prev,
        [path]: { ...existing, content: newContent, dirty },
      };
    });
  }, []);

  const addFile = useCallback((path: string, initialContent: string) => {
    setFiles((prev) => ({
      ...prev,
      [path]: {
        content: initialContent,
        originalContent: "",
        dirty: true,
      },
    }));
    setActivePathState(path);
  }, []);

  const deleteFile = useCallback((path: string) => {
    setFiles((prev) => {
      const existing = prev[path];
      if (!existing) {
        // Not loaded yet — create a tombstone so save still emits the delete.
        return {
          ...prev,
          [path]: { content: "", originalContent: "", dirty: true, deleted: true },
        };
      }
      // Brand-new file (originalContent === "") → discard instead of tombstoning.
      if (existing.originalContent === "" && !existing.deleted) {
        const { [path]: _removed, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [path]: { ...existing, deleted: true, dirty: true },
      };
    });
  }, []);

  const discardFile = useCallback((path: string) => {
    setFiles((prev) => {
      const existing = prev[path];
      if (!existing) return prev;
      // New file never committed → remove entirely.
      if (existing.originalContent === "" && !existing.deleted) {
        const { [path]: _removed, ...rest } = prev;
        return rest;
      }
      // Was tombstoned but originally a new file — also remove.
      if (existing.originalContent === "" && existing.deleted) {
        const { [path]: _removed, ...rest } = prev;
        return rest;
      }
      // Existing file: reset buffer and clear tombstone.
      return {
        ...prev,
        [path]: {
          content: existing.originalContent,
          originalContent: existing.originalContent,
          dirty: false,
          deleted: false,
        },
      };
    });
  }, []);

  const dirtyPaths = useMemo(() => {
    const set = new Set<string>();
    for (const [path, buf] of Object.entries(files)) {
      if (buf.dirty || buf.deleted) set.add(path);
    }
    return set;
  }, [files]);

  const discardAll = useCallback(() => {
    for (const path of Array.from(dirtyPaths)) {
      discardFile(path);
    }
  }, [dirtyPaths, discardFile]);

  const saveMutation = useMutation({
    mutationFn: async (commitMessage: string) => {
      const changes = computeChangesFromFiles(files);
      return governedWorkflowsApi.batchCommitFiles(companyId, name, {
        commitMessage,
        changes,
      });
    },
    onSuccess: () => {
      // Nuke all file caches and the detail/list so fresh data is pulled.
      qc.invalidateQueries({
        queryKey: queryKeys.governedWorkflows.files(companyId, name),
      });
      qc.invalidateQueries({
        queryKey: queryKeys.governedWorkflows.file(companyId, name, ""),
        predicate: (query) => {
          const key = query.queryKey as unknown[];
          // ["governed-workflows", "file", companyId, name, ...]
          return (
            key[0] === "governed-workflows" &&
            key[1] === "file" &&
            key[2] === companyId &&
            key[3] === name
          );
        },
      });
      qc.invalidateQueries({
        queryKey: queryKeys.governedWorkflows.detail(companyId, name),
      });
      qc.invalidateQueries({
        queryKey: queryKeys.governedWorkflows.list(companyId),
      });
      // Reset local state so the tree effect re-seeds from fresh data.
      setFiles({});
      setActivePathState(null);
      defaultSeededRef.current = false;
    },
  });

  const save = useCallback(
    (commitMessage: string) => saveMutation.mutateAsync(commitMessage),
    [saveMutation],
  );

  return {
    tree: treeQuery.data?.tree,
    files,
    activePath,
    setActivePath,
    editFile,
    addFile,
    deleteFile,
    discardFile,
    discardAll,
    dirtyCount: dirtyPaths.size,
    dirtyPaths,
    save,
    isLoadingTree: treeQuery.isLoading,
    treeError: (treeQuery.error as Error | null) ?? null,
    isSaving: saveMutation.isPending,
    saveError: (saveMutation.error as Error | null) ?? null,
  };
}
