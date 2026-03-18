/**
 * TraceTimelineDemo — Standalone demo page for the Langfuse-style timeline
 * Uses mock data only, no API calls. Accessible at /traces/demo
 */

import { useState } from "react";
import { ArrowLeft, Layers, Bot, Clock, DollarSign, CheckCircle, Sparkles } from "lucide-react";
import { Link } from "@/lib/router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TraceTimeline, MOCK_OBSERVATIONS, MOCK_PHASES, MOCK_GOLD } from "../components/traces/TraceTimeline";
import { GoldVerdictBanner } from "../components/traces/GoldVerdictBanner";

export function TraceTimelineDemo() {
  const [showAcStatus, setShowAcStatus] = useState(true);

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Back link */}
      <Link
        to="/traces"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground no-underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Traces
      </Link>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Fix authentication bug in login flow</h1>
          <Badge variant="secondary">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
          <Badge variant="outline" className="text-amber-400 border-amber-400/30">
            <Sparkles className="h-3 w-3 mr-1" />
            Gold Analysis
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Bot className="h-3.5 w-3.5" />
            Founding Engineer
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            36s
          </span>
          <span className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            $0.34
          </span>
          <span>22.7k tokens</span>
          <span>Issue #42 — Fix password comparison vulnerability</span>
        </div>
      </div>

      {/* Gold Verdict Banner */}
      <GoldVerdictBanner gold={MOCK_GOLD} />

      {/* Issue AC Status */}
      {showAcStatus && MOCK_GOLD.issueAcStatus && (
        <div className="flex flex-wrap gap-2">
          {MOCK_GOLD.issueAcStatus.map((ac) => (
            <div
              key={ac.acId}
              className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs ${
                ac.status === "met"
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
                  : ac.status === "partial"
                    ? "border-amber-500/30 bg-amber-500/5 text-amber-400"
                    : "border-red-500/30 bg-red-500/5 text-red-400"
              }`}
            >
              <CheckCircle className="h-3 w-3" />
              <span className="font-medium">AC-{ac.acId}</span>
              <span className="text-muted-foreground">{ac.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Execution Timeline */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Execution Timeline
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-[10px] h-6 text-muted-foreground"
            onClick={() => setShowAcStatus(!showAcStatus)}
          >
            {showAcStatus ? "Hide AC status" : "Show AC status"}
          </Button>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <TraceTimeline
            observations={MOCK_OBSERVATIONS}
            phases={MOCK_PHASES}
            gold={MOCK_GOLD}
            totalDurationMs={36000}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-[10px] text-muted-foreground border-t border-border pt-3">
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-blue-500" /> Comprehension</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-emerald-500" /> Implementation</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-amber-500" /> Verification</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-purple-400" /> Communication</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-slate-500" /> Initialization</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-cyan-500" /> Result</span>
        <span className="flex items-center gap-1"><Sparkles className="h-2.5 w-2.5 text-amber-400" /> Key observation</span>
      </div>
    </div>
  );
}
