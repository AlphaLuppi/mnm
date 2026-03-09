"use client";

import { useState } from "react";
import {
  Folder,
  FolderOpen,
  File,
  ChevronRight,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: TreeNode[];
}

interface FileTreeProps {
  tree: TreeNode[];
  selectedPath?: string;
  onSelectFile: (filePath: string) => void;
}

function FileTreeNode({
  node,
  depth,
  selectedPath,
  onSelectFile,
}: {
  node: TreeNode;
  depth: number;
  selectedPath?: string;
  onSelectFile: (filePath: string) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const isDir = node.type === "directory";
  const isSelected = node.path === selectedPath;

  if (isDir) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-1 rounded-sm px-1 py-0.5 text-sm hover:bg-accent"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform",
              open && "rotate-90"
            )}
          />
          {open ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {open && node.children && (
          <div>
            {node.children.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelectFile(node.path)}
      className={cn(
        "flex w-full items-center gap-1 rounded-sm px-1 py-0.5 text-sm hover:bg-accent",
        isSelected && "bg-accent font-medium"
      )}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
    >
      <File className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function FileTree({ tree, selectedPath, onSelectFile }: FileTreeProps) {
  return (
    <ScrollArea className="h-full">
      <div className="py-1">
        {tree.map((node) => (
          <FileTreeNode
            key={node.path}
            node={node}
            depth={0}
            selectedPath={selectedPath}
            onSelectFile={onSelectFile}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
