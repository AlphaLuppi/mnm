"use client";

import { useEffect, useState } from "react";
import { FileTree } from "@/components/files/file-tree";
import { CodeViewer } from "@/components/files/code-viewer";
import { RelatedSpecsPanel } from "@/components/files/related-specs-panel";
import { Separator } from "@/components/ui/separator";

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: TreeNode[];
}

interface FileContent {
  path: string;
  content: string;
  size: number;
  lines: number;
}

export default function FilesPage() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<FileContent | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/files")
      .then((r) => r.json())
      .then((data) => setTree(data.tree ?? []))
      .catch(() => {});
  }, []);

  async function handleSelectFile(filePath: string) {
    setSelectedPath(filePath);
    setLoading(true);
    try {
      const res = await fetch(`/api/files/${filePath}`);
      if (res.ok) {
        const data = await res.json();
        setFileContent(data);
      } else {
        setFileContent(null);
      }
    } catch {
      setFileContent(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0 overflow-hidden rounded-lg border">
      {/* File Tree */}
      <div className="w-64 shrink-0 border-r">
        <div className="border-b bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
          Explorer
        </div>
        <FileTree
          tree={tree}
          selectedPath={selectedPath ?? undefined}
          onSelectFile={handleSelectFile}
        />
      </div>

      {/* Code Viewer */}
      <div className="flex-1 min-w-0">
        {loading && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        )}
        {!loading && !fileContent && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Select a file to view its contents
            </p>
          </div>
        )}
        {!loading && fileContent && (
          <CodeViewer
            content={fileContent.content}
            filePath={fileContent.path}
            lines={fileContent.lines}
          />
        )}
      </div>

      {/* Related Specs */}
      <div className="w-56 shrink-0 border-l">
        <RelatedSpecsPanel filePath={selectedPath} />
      </div>
    </div>
  );
}
