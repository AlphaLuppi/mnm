/**
 * SessionBundleBadge
 *
 * Affiche un badge sur une step gouvernée quand celle-ci a un client run lié
 * (path session-file-bundled, Task 7). Cliquable → navigue vers la trace
 * reconstruite depuis le .jsonl Claude Code.
 *
 * Statuts visuels :
 *   - Trace existe (heartbeat_run finalisé) → badge cliquable "Session capturée"
 *     avec count des observations + tokens si dispos
 *   - Trace pas encore là (run en cours, finalize pas done) → badge "..." mute
 *   - Erreur API → badge silent (pas de pollution UI)
 */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router";
import { Sparkles, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { tracesApi } from "../../api/traces";
import { queryKeys } from "../../lib/queryKeys";

interface SessionBundleBadgeProps {
  companyId: string;
  heartbeatRunId: string;
}

export function SessionBundleBadge({ companyId, heartbeatRunId }: SessionBundleBadgeProps) {
  const navigate = useNavigate();

  const { data: trace, isLoading, isError } = useQuery({
    queryKey: queryKeys.traces.byRunId(companyId, heartbeatRunId),
    queryFn: () => tracesApi.getByHeartbeatRunId(companyId, heartbeatRunId),
    // The trace is only created at finalize time (post-completeStep). Retry a
    // bit to bridge the moment between "step succeeded" and "trace ready".
    retry: 3,
    retryDelay: 800,
    staleTime: 5_000,
  });

  if (isError) return null;

  if (isLoading || !trace) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="text-xs gap-1 cursor-default">
            <Loader2 className="h-3 w-3 animate-spin" />
            Capture session…
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          Le serveur reconstruit la timeline depuis le .jsonl Claude Code.
        </TooltipContent>
      </Tooltip>
    );
  }

  const obsCount = trace.observations?.length ?? 0;
  const tokensIn = trace.totalTokensIn ?? 0;
  const tokensOut = trace.totalTokensOut ?? 0;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="default"
          className="text-xs gap-1 cursor-pointer hover:opacity-80"
          onClick={() => navigate(`/traces/${trace.id}`)}
        >
          <Sparkles className="h-3 w-3" />
          Session ({obsCount} obs · {(tokensIn + tokensOut).toLocaleString()} tok)
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        Voir la timeline reconstruite (parser claude-code-jsonl-v1).
      </TooltipContent>
    </Tooltip>
  );
}
