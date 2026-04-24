/**
 * FileTree — sidebar for the Workflow Studio (U13.5).
 *
 * Pure, prop-driven component: consumes a flat list of TreeEntry rows from
 * the backend (`governedWorkflowsApi.listFiles`), groups them into a nested
 * hierarchy by `/` segments, and renders a recursive tree with hover
 * affordances for add/delete. The page layer (U13.8) wires the handlers.
 *
 * Design notes:
 * - We derive directories from blob paths rather than trusting server-side
 *   `type: "tree"` entries. GitLab returns tree entries; LocalBareRepo may or
 *   may not — normalising here keeps the UI consistent across backends.
 * - Hand-rolled recursive <ul> instead of react-arborist: keeps the dep
 *   surface tight, plays nicely with jsdom, and the tree depths we care about
 *   (workflow subtree: usually <= 3 levels) don't justify a virtualised lib.
 * - Root directory handle is the empty string `""` — `onAddFile("")` creates
 *   a file at the workflow root.
 */
import { useMemo, useState } from "react";
import type { TreeEntry } from "@/api/governed-workflows";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, ChevronDown, Plus, Trash2, FileText, Folder } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FileTreeProps {
  tree: TreeEntry[];
  activePath: string | null;
  dirtyPaths: Set<string>;
  onSelect: (path: string) => void;
  onAddFile?: (parentDir: string) => void;
  onDelete?: (path: string) => void;
  isLoading?: boolean;
}

/** Internal nested tree node derived from flat TreeEntry[] paths. */
interface TreeNode {
  /** Segment name (e.g. `lint.ts` or `gates`). Empty string for the root. */
  name: string;
  /** Full path from workflow root (e.g. `gates/lint.ts`). Empty string for root. */
  path: string;
  /** Leaf = file, non-leaf = directory. Derived from whether a blob exists at `path`. */
  isDir: boolean;
  /** Child nodes, sorted dirs-first then alphabetically. */
  children: TreeNode[];
}

/**
 * Build a nested tree from a flat list of TreeEntry rows. Only blob entries
 * are used as sources of truth — intermediate directories are synthesised
 * from the path segments so the UI looks the same regardless of whether the
 * server returned explicit `type: "tree"` rows.
 *
 * Exported for unit tests.
 */
export function buildTree(entries: TreeEntry[]): TreeNode {
  const root: TreeNode = { name: "", path: "", isDir: true, children: [] };

  const blobs = entries.filter((e) => e.type === "blob");
  for (const entry of blobs) {
    const segments = entry.path.split("/").filter(Boolean);
    if (segments.length === 0) continue;

    let current = root;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const isLast = i === segments.length - 1;
      const fullPath = segments.slice(0, i + 1).join("/");

      let child = current.children.find((c) => c.name === seg);
      if (!child) {
        child = {
          name: seg,
          path: fullPath,
          isDir: !isLast,
          children: [],
        };
        current.children.push(child);
      }
      current = child;
    }
  }

  // Sort: directories first, then alphabetically.
  const sortRec = (node: TreeNode): void => {
    node.children.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const child of node.children) sortRec(child);
  };
  sortRec(root);

  return root;
}

interface RowProps {
  node: TreeNode;
  depth: number;
  activePath: string | null;
  dirtyPaths: Set<string>;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  onAddFile?: (parentDir: string) => void;
  onDelete?: (path: string) => void;
}

function TreeRow(props: RowProps) {
  const {
    node,
    depth,
    activePath,
    dirtyPaths,
    expanded,
    onToggle,
    onSelect,
    onAddFile,
    onDelete,
  } = props;

  const isActive = !node.isDir && node.path === activePath;
  const isDirty = !node.isDir && dirtyPaths.has(node.path);
  const isOpen = expanded.has(node.path);

  // Indent via inline style so we don't have to worry about Tailwind JIT purging
  // dynamic classes like pl-[12px].
  const indentStyle = { paddingLeft: `${depth * 12 + 4}px` } as const;

  return (
    <li className="list-none">
      <div
        className={cn(
          "group flex items-center gap-1 pr-1 py-0.5 rounded-sm cursor-pointer hover:bg-muted/60 font-mono text-xs",
          isActive && "bg-accent text-accent-foreground hover:bg-accent",
        )}
        style={indentStyle}
        data-path={node.path}
        data-testid={`tree-row-${node.path || "root"}`}
        onClick={() => {
          if (node.isDir) onToggle(node.path);
          else onSelect(node.path);
        }}
      >
        {node.isDir ? (
          <>
            {isOpen ? (
              <ChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
            )}
            <Folder className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
          </>
        ) : (
          <>
            <span className="inline-block w-3 flex-shrink-0" />
            <FileText className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
          </>
        )}
        <span className="truncate flex-1">{node.name}</span>
        {isDirty && (
          <span
            className="text-primary text-base leading-none flex-shrink-0"
            aria-label="modifié"
            data-testid={`dirty-${node.path}`}
          >
            •
          </span>
        )}
        {node.isDir && onAddFile && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="opacity-0 group-hover:opacity-100 h-5 w-5"
            title={`Créer un fichier dans ${node.path || "/"}`}
            onClick={(e) => {
              e.stopPropagation();
              onAddFile(node.path);
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}
        {!node.isDir && onDelete && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="opacity-0 group-hover:opacity-100 h-5 w-5 text-destructive hover:text-destructive"
            title={`Supprimer ${node.path}`}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.path);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      {node.isDir && isOpen && node.children.length > 0 && (
        <ul className="list-none">
          {node.children.map((child) => (
            <TreeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              dirtyPaths={dirtyPaths}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              onAddFile={onAddFile}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function FileTree(props: FileTreeProps) {
  const { tree, activePath, dirtyPaths, onSelect, onAddFile, onDelete, isLoading } = props;

  const root = useMemo(() => buildTree(tree), [tree]);

  // Collect every directory path so we can expand them all by default on mount.
  const initialExpanded = useMemo(() => {
    const set = new Set<string>();
    const walk = (node: TreeNode) => {
      if (node.isDir) {
        set.add(node.path);
        for (const c of node.children) walk(c);
      }
    };
    walk(root);
    return set;
  }, [root]);

  const [expanded, setExpanded] = useState<Set<string>>(initialExpanded);

  const handleToggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1 p-2" data-testid="file-tree-loading">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  }

  if (root.children.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 p-6 text-center"
        data-testid="file-tree-empty"
      >
        <p className="text-xs text-muted-foreground">Aucun fichier</p>
        {onAddFile && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddFile("")}
          >
            <Plus className="h-3.5 w-3.5" />
            Créer un fichier
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto py-1" data-testid="file-tree">
      {/* Root-level "add file" affordance: render a tiny toolbar above the tree
          when onAddFile is provided, so users can add at workflow root even
          when the hover-on-dir pattern isn't discoverable. */}
      {onAddFile && (
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Fichiers
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            className="h-5 w-5"
            title="Créer un fichier à la racine"
            onClick={() => onAddFile("")}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}
      <ul className="list-none">
        {root.children.map((child) => (
          <TreeRow
            key={child.path}
            node={child}
            depth={0}
            activePath={activePath}
            dirtyPaths={dirtyPaths}
            expanded={expanded}
            onToggle={handleToggle}
            onSelect={onSelect}
            onAddFile={onAddFile}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </div>
  );
}
