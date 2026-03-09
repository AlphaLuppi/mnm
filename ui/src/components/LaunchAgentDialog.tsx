import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Rocket, Loader2 } from "lucide-react";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { queryKeys } from "../lib/queryKeys";
import { useToast } from "../context/ToastContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const WORKFLOW_TYPES = [
  { value: "dev-story", label: "Dev Story" },
  { value: "correct-course", label: "Correct Course" },
  { value: "code-review", label: "Code Review" },
] as const;

interface LaunchAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  projectId?: string;
  storyTitle: string;
  storyContent: string;
  onIssueCreated?: (issueId: string) => void;
}

export function LaunchAgentDialog({
  open,
  onOpenChange,
  companyId,
  projectId,
  storyTitle,
  storyContent,
  onIssueCreated,
}: LaunchAgentDialogProps) {
  const { pushToast } = useToast();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [workflowType, setWorkflowType] = useState<string>("dev-story");
  const [submitting, setSubmitting] = useState(false);

  const { data: agents = [], isLoading: loadingAgents } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    enabled: open && !!companyId,
  });

  const activeAgents = agents.filter((a) => a.status === "active");

  const handleSubmit = async () => {
    if (!selectedAgentId) return;
    setSubmitting(true);
    try {
      const issue = await issuesApi.create(companyId, {
        title: `[${workflowType}] ${storyTitle}`,
        body: storyContent,
        assigneeAgentId: selectedAgentId,
        ...(projectId ? { projectId } : {}),
      });
      onIssueCreated?.(issue.id);
      pushToast({
        title: "Agent launched",
        body: `Issue created and assigned to agent for "${storyTitle}"`,
        tone: "success",
      });
      onOpenChange(false);
      setSelectedAgentId("");
      setWorkflowType("dev-story");
    } catch (err) {
      pushToast({
        title: "Failed to launch agent",
        body: err instanceof Error ? err.message : "Unknown error",
        tone: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Lancer un agent
          </DialogTitle>
          <DialogDescription>
            Select an agent and workflow type to assign this story.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Agent</label>
            {loadingAgents ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading agents...
              </div>
            ) : activeAgents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active agents available.</p>
            ) : (
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                  {activeAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Workflow type</label>
            <Select value={workflowType} onValueChange={setWorkflowType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORKFLOW_TYPES.map((wt) => (
                  <SelectItem key={wt.value} value={wt.value}>
                    {wt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border border-border bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">Story</p>
            <p className="text-sm font-medium truncate">{storyTitle}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedAgentId || submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Launching...
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4 mr-2" />
                Launch
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
