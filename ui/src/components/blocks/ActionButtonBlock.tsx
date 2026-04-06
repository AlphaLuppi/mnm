import { useState } from "react";
import type { ActionButtonBlock as ActionButtonBlockType } from "@mnm/shared";
import type { BlockContext } from "./BlockRenderer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  GitMerge,
  UserPlus,
  Pause,
  Play,
  X,
  Check,
  TrendingDown,
  Send,
  Trash2,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  "refresh-cw": RefreshCw,
  "git-merge": GitMerge,
  "user-plus": UserPlus,
  "pause": Pause,
  "play": Play,
  "x": X,
  "check": Check,
  "trending-down": TrendingDown,
  "send": Send,
  "trash": Trash2,
};

export function ActionButtonBlock({ block, context }: { block: ActionButtonBlockType; context: BlockContext }) {
  const [confirming, setConfirming] = useState(false);
  const [executing, setExecuting] = useState(false);

  const isDisabled = block.permission && context.hasPermission
    ? !context.hasPermission(block.permission)
    : false;

  const Icon = block.icon ? ICON_MAP[block.icon] : null;

  async function handleClick() {
    if (block.confirm) {
      setConfirming(true);
      return;
    }
    await execute();
  }

  async function execute() {
    setExecuting(true);
    setConfirming(false);
    try {
      await context.onAction(block.action, block.payload);
    } finally {
      setExecuting(false);
    }
  }

  return (
    <>
      <Button
        variant={block.variant ?? "default"}
        size="sm"
        disabled={isDisabled || executing}
        onClick={handleClick}
        title={isDisabled ? "You don't have permission for this action" : undefined}
      >
        {executing ? (
          "..."
        ) : (
          <>
            {Icon && <Icon className="h-3.5 w-3.5 mr-1.5" />}
            {block.label}
          </>
        )}
      </Button>

      {block.confirm && (
        <Dialog open={confirming} onOpenChange={setConfirming}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm action</DialogTitle>
              <DialogDescription>{block.confirm}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirming(false)}>Cancel</Button>
              <Button variant={block.variant ?? "default"} onClick={execute} disabled={executing}>
                {executing ? "..." : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
