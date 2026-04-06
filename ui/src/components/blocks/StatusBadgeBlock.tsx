import type { StatusBadgeBlock as StatusBadgeBlockType } from "@mnm/shared";
import type { BlockContext } from "./BlockRenderer";
import { Badge } from "@/components/ui/badge";

const VARIANT_CLASSES: Record<StatusBadgeBlockType["variant"], string> = {
  success: "bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400",
  warning: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  error: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
  info: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
  neutral: "bg-muted text-muted-foreground border-border",
};

export function StatusBadgeBlock({ block }: { block: StatusBadgeBlockType; context: BlockContext }) {
  return (
    <Badge variant="outline" className={VARIANT_CLASSES[block.variant]}>
      {block.text}
    </Badge>
  );
}
