import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Plus, ChevronDown, Loader2 } from "lucide-react";
import { lensesApi, type TraceLens, type CreateLensInput } from "../../api/lenses";
import { queryKeys } from "../../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LensSelectorProps {
  companyId: string;
  traceId: string;
  selectedLensId: string | null;
  onSelectLens: (lensId: string | null) => void;
}

export function LensSelector({
  companyId,
  traceId,
  selectedLensId,
  onSelectLens,
}: LensSelectorProps) {
  const queryClient = useQueryClient();
  const [showCustom, setShowCustom] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [customName, setCustomName] = useState("");

  const { data: lenses, isLoading } = useQuery({
    queryKey: queryKeys.lenses.list(companyId),
    queryFn: () => lensesApi.list(companyId),
    enabled: !!companyId,
  });

  const createLensMutation = useMutation({
    mutationFn: (input: CreateLensInput) => lensesApi.create(companyId, input),
    onSuccess: (newLens) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lenses.list(companyId) });
      onSelectLens(newLens.id);
      setShowCustom(false);
      setCustomPrompt("");
      setCustomName("");
    },
  });

  const userLenses = (lenses ?? []).filter((l) => !l.isTemplate && l.isActive);
  const templateLenses = (lenses ?? []).filter((l) => l.isTemplate);
  const selectedLens = (lenses ?? []).find((l) => l.id === selectedLensId);

  const handleCreateCustom = () => {
    if (!customPrompt.trim()) return;
    createLensMutation.mutate({
      name: customName.trim() || "Custom Analysis",
      prompt: customPrompt.trim(),
    });
  };

  return (
    <div data-testid="trace-09-lens-selector" className="space-y-3">
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              data-testid="trace-09-lens-dropdown"
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {selectedLens ? selectedLens.name : "Choose an analysis..."}
              <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[320px]">
            {/* User lenses */}
            {userLenses.length > 0 && (
              <>
                {userLenses.map((lens) => (
                  <DropdownMenuItem
                    key={lens.id}
                    data-testid={`trace-09-lens-option-${lens.id}`}
                    onClick={() => onSelectLens(lens.id)}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{lens.name}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[280px]">
                        {lens.prompt}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}

            {/* Template suggestions */}
            {templateLenses.length > 0 && (
              <>
                {templateLenses.map((lens) => (
                  <DropdownMenuItem
                    key={lens.id}
                    data-testid={`trace-09-lens-template-${lens.id}`}
                    onClick={() => onSelectLens(lens.id)}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{lens.name}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[280px]">
                        {lens.prompt}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}

            {/* Custom option */}
            <DropdownMenuItem
              data-testid="trace-09-lens-custom"
              onClick={() => { setShowCustom(true); onSelectLens(null); }}
            >
              <div className="flex items-center gap-2">
                <Plus className="h-3.5 w-3.5" />
                <span className="text-sm">Write a custom analysis...</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {selectedLensId && (
          <Button
            data-testid="trace-09-lens-clear"
            variant="ghost"
            size="sm"
            onClick={() => onSelectLens(null)}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Custom analysis input */}
      {showCustom && (
        <div data-testid="trace-09-custom-analysis" className="space-y-3 rounded-md border border-border p-4">
          <Input
            data-testid="trace-09-custom-name"
            placeholder="Analysis name (optional)"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="h-8"
          />
          <Textarea
            data-testid="trace-09-custom-prompt"
            placeholder="Describe what you want to understand about this trace... e.g., 'What files were modified and what was the reasoning behind each change?'"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={3}
          />
          <div className="flex items-center gap-2">
            <Button
              data-testid="trace-09-custom-submit"
              size="sm"
              onClick={handleCreateCustom}
              disabled={!customPrompt.trim() || createLensMutation.isPending}
            >
              {createLensMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              )}
              Create & Analyze
            </Button>
            <Button
              data-testid="trace-09-custom-cancel"
              variant="ghost"
              size="sm"
              onClick={() => { setShowCustom(false); setCustomPrompt(""); setCustomName(""); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
