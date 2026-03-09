"use client";

import { useState, useCallback } from "react";
import useSWR, { mutate } from "swr";
import {
  Check,
  ChevronsUpDown,
  FolderPlus,
  Trash2,
  Folder,
  FolderGit2,
  ArrowUp,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProject } from "@/contexts/project-context";

interface DirEntry {
  name: string;
  path: string;
  hasGit: boolean;
}

interface BrowseResponse {
  current: string;
  parent: string | null;
  hasGit: boolean;
  dirs: DirEntry[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function basename(p: string): string {
  return p.split("/").filter(Boolean).pop() ?? p;
}

export function ProjectSwitcher() {
  const { projects, activeProject, switchProject } = useProject();
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedPath, setSelectedPath] = useState("");
  const [error, setError] = useState("");
  const [switching, setSwitching] = useState(false);

  // Folder browser state
  const [browsePath, setBrowsePath] = useState("");
  const { data: browseData } = useSWR<BrowseResponse>(
    addOpen ? `/api/projects/browse${browsePath ? `?path=${encodeURIComponent(browsePath)}` : ""}` : null,
    fetcher
  );

  const openAddDialog = useCallback(() => {
    setNewName("");
    setSelectedPath("");
    setBrowsePath("");
    setError("");
    setAddOpen(true);
  }, []);

  function selectFolder(dirPath: string) {
    setSelectedPath(dirPath);
    setNewName((prev) => prev || basename(dirPath));
  }

  function navigateTo(dirPath: string) {
    setBrowsePath(dirPath);
  }

  async function handleSwitch(id: string) {
    if (id === activeProject?.id) return;
    setSwitching(true);
    try {
      await switchProject(id);
    } finally {
      setSwitching(false);
    }
  }

  async function handleAdd() {
    setError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, path: selectedPath }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      setAddOpen(false);
      await mutate("/api/projects");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleRemove(id: string) {
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (res.ok) {
      await mutate("/api/projects");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left hover:bg-accent transition-colors"
            disabled={switching}
          >
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-semibold truncate">
                {activeProject?.name ?? "MnM"}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {activeProject ? basename(activeProject.path) : ""}
              </span>
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {projects.map((project) => (
            <DropdownMenuItem
              key={project.id}
              className="flex items-center justify-between gap-2"
              onSelect={() => handleSwitch(project.id)}
            >
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm truncate">{project.name}</span>
                <span className="text-xs text-muted-foreground truncate">
                  {project.path}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {project.id === activeProject?.id && (
                  <Check className="h-4 w-4" />
                )}
                {project.id !== activeProject?.id && (
                  <button
                    className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(project.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={openAddDialog}>
            <FolderPlus className="h-4 w-4 mr-2" />
            Add Project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                placeholder="My Project"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>

            {/* Selected path display */}
            {selectedPath && (
              <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                <FolderGit2 className="h-4 w-4 shrink-0 text-green-500" />
                <span className="truncate font-mono text-xs">{selectedPath}</span>
              </div>
            )}

            {/* Folder browser */}
            <div className="grid gap-1.5">
              <Label>Select Folder</Label>
              <div className="rounded-md border">
                {/* Current path breadcrumb */}
                <div className="flex items-center gap-1 border-b bg-muted/30 px-3 py-1.5">
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {browseData?.current ?? "~"}
                  </span>
                </div>

                {/* Directory listing */}
                <div className="max-h-56 overflow-y-auto">
                  {/* Go up */}
                  {browseData?.parent && (
                    <button
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                      onClick={() => navigateTo(browseData.parent!)}
                    >
                      <ArrowUp className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">..</span>
                    </button>
                  )}

                  {/* Select current folder if it has .git */}
                  {browseData?.hasGit && browseData.current !== selectedPath && (
                    <button
                      className="flex w-full items-center gap-2 border-b bg-green-500/5 px-3 py-1.5 text-sm font-medium text-green-600 hover:bg-green-500/10 transition-colors dark:text-green-400"
                      onClick={() => selectFolder(browseData.current)}
                    >
                      <FolderGit2 className="h-3.5 w-3.5" />
                      Select this folder
                    </button>
                  )}

                  {browseData?.dirs.map((dir) => (
                    <div
                      key={dir.path}
                      className="group flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                    >
                      <button
                        className="flex min-w-0 flex-1 items-center gap-2"
                        onClick={() => navigateTo(dir.path)}
                      >
                        {dir.hasGit ? (
                          <FolderGit2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
                        ) : (
                          <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate">{dir.name}</span>
                      </button>
                      {dir.hasGit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => selectFolder(dir.path)}
                        >
                          Select
                        </Button>
                      )}
                    </div>
                  ))}

                  {browseData?.dirs.length === 0 && (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                      No subdirectories
                    </div>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!newName || !selectedPath}>
              Add Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
