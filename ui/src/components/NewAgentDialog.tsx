import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Bot,
  Crown,
  Sparkles,
  Settings2,
} from "lucide-react";

export function NewAgentDialog() {
  const { newAgentOpen, closeNewAgent, openNewIssue } = useDialog();
  const { selectedCompanyId } = useCompany();
  const navigate = useNavigate();

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId && newAgentOpen,
  });

  // Find the CAO agent (identified by metadata.isCAO or name "CAO")
  const caoAgent = (agents ?? []).find((a) => a.name === "CAO");

  function handleAskCao() {
    closeNewAgent();
    openNewIssue({
      assigneeAgentId: caoAgent?.id,
      title: "Create a new agent",
      description: "(Describe the agent you want: name, purpose, capabilities, which tags it should have)",
    });
  }

  function handleManualConfig() {
    closeNewAgent();
    // Go directly to agent creation with claude_local adapter (no adapter picker)
    navigate(`/agents/new?adapterType=claude_local`);
  }

  return (
    <Dialog
      open={newAgentOpen}
      onOpenChange={(open) => {
        if (!open) closeNewAgent();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md p-0 gap-0 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <span className="text-sm text-muted-foreground">Add a new agent</span>
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            onClick={() => closeNewAgent()}
          >
            <span className="text-lg leading-none">&times;</span>
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* CAO recommendation */}
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent">
              <Crown className="h-6 w-6 text-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              The CAO (Chief Agent Officer) can create and configure agents
              for you — it knows the org structure, tags, and permissions.
            </p>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={handleAskCao}
            disabled={!caoAgent}
          >
            <Bot className="h-4 w-4 mr-2" />
            Ask the CAO to create a new agent
          </Button>

          {!caoAgent && (
            <p className="text-xs text-center text-muted-foreground">
              CAO agent not found. Complete onboarding first.
            </p>
          )}

          {/* Manual config */}
          <div className="text-center">
            <button
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              onClick={handleManualConfig}
            >
              <Settings2 className="h-3 w-3" />
              Create manually with Claude Code
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
