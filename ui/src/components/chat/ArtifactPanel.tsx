import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Copy, Download, Pencil, Check, History, ExternalLink, Code, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ArtifactVersion } from "@mnm/shared";
import { artifactsApi } from "../../api/artifacts";
import { queryKeys } from "../../lib/queryKeys";
import { ArtifactRenderer } from "./ArtifactRenderer";
import { ArtifactVersionHistory } from "./ArtifactVersionHistory";

interface ArtifactPanelProps {
  companyId: string;
  artifactId: string;
  onClose: () => void;
}

export function ArtifactPanel({
  companyId,
  artifactId,
  onClose,
}: ArtifactPanelProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [showVersions, setShowVersions] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<ArtifactVersion | null>(
    null,
  );

  const { data: artifact, isLoading } = useQuery({
    queryKey: queryKeys.artifacts.detail(companyId, artifactId),
    queryFn: () => artifactsApi.getById(companyId, artifactId),
    enabled: !!companyId && !!artifactId,
  });

  const updateMutation = useMutation({
    mutationFn: (input: { content: string; changeSummary?: string }) =>
      artifactsApi.update(companyId, artifactId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.artifacts.detail(companyId, artifactId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.artifacts.versions(companyId, artifactId),
      });
      setEditing(false);
      setViewingVersion(null);
    },
  });

  const handleCopy = () => {
    const text =
      viewingVersion?.content ?? artifact?.currentVersion?.content ?? "";
    navigator.clipboard.writeText(text);
  };

  const handleDownload = () => {
    const text =
      viewingVersion?.content ?? artifact?.currentVersion?.content ?? "";
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact?.title ?? "artifact"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStartEdit = () => {
    setEditing(true);
    setEditContent(
      viewingVersion?.content ?? artifact?.currentVersion?.content ?? "",
    );
    setViewingVersion(null);
  };

  const handleSaveEdit = () => {
    if (!editContent.trim()) return;
    updateMutation.mutate({
      content: editContent,
      changeSummary: "Manual edit",
    });
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditContent("");
  };

  const handleSelectVersion = (version: ArtifactVersion) => {
    setViewingVersion(version);
    setEditing(false);
  };

  const openInNewTab = useCallback(() => {
    const text =
      viewingVersion?.content ?? artifact?.currentVersion?.content ?? "";
    const mimeType =
      artifact?.artifactType === "html" ||
      (artifact?.artifactType === "code" && artifact?.language?.toLowerCase() === "html")
        ? "text/html"
        : "text/plain";
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }, [viewingVersion, artifact]);

  /** Whether the artifact can be rendered as a preview (HTML, code-html) */
  const isPreviewable =
    artifact?.artifactType === "html" ||
    (artifact?.artifactType === "code" && artifact?.language?.toLowerCase() === "html");

  const displayContent =
    viewingVersion?.content ?? artifact?.currentVersion?.content ?? "";

  if (isLoading) {
    return (
      <div className="flex flex-col h-full border-l border-border w-80">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm text-muted-foreground">Loading...</span>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (!artifact) {
    return (
      <div className="flex flex-col h-full border-l border-border w-80">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm text-muted-foreground">
            Artifact not found
          </span>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border-l border-border w-80">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm font-medium truncate">
            {artifact.title}
          </span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
            {artifact.artifactType}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close artifact panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Version viewing banner */}
      {viewingVersion && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300">
          Viewing v{viewingVersion.versionNumber}
          {viewingVersion.id !== artifact.currentVersionId && (
            <span className="ml-1 text-amber-500">(not current)</span>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-1 border-b border-border px-3 py-1.5">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleCopy}
          title="Copy content"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleDownload}
          title="Download"
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
        {!editing ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleStartEdit}
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleSaveEdit}
              title="Save"
              disabled={updateMutation.isPending}
            >
              <Check className="h-3.5 w-3.5 text-green-600" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleCancelEdit}
              title="Cancel"
            >
              <X className="h-3.5 w-3.5 text-red-600" />
            </Button>
          </>
        )}
        {isPreviewable && !editing && (
          <Button
            variant={showCode ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => setShowCode((v) => !v)}
            title={showCode ? "Show preview" : "Show code"}
          >
            {showCode ? <Eye className="h-3.5 w-3.5" /> : <Code className="h-3.5 w-3.5" />}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={openInNewTab}
          title="Open in new tab"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
        <div className="flex-1" />
        <Button
          variant={showVersions ? "secondary" : "ghost"}
          size="icon-sm"
          onClick={() => setShowVersions((v) => !v)}
          title="Version history"
        >
          <History className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {editing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
          />
        ) : (
          <ArtifactRenderer
            content={displayContent}
            artifactType={artifact.artifactType}
            language={artifact.language}
            showCode={showCode}
          />
        )}
      </div>

      {/* Version history panel */}
      {showVersions && (
        <ArtifactVersionHistory
          companyId={companyId}
          artifactId={artifactId}
          currentVersionId={artifact.currentVersionId}
          onSelectVersion={handleSelectVersion}
        />
      )}
    </div>
  );
}
