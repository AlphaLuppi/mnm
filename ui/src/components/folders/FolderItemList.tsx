import { FileText, MessageSquare, Package, Trash2 } from "lucide-react";
import type { FolderItem } from "@mnm/shared";
import { Button } from "@/components/ui/button";
import { timeAgo } from "../../lib/timeAgo";

const ITEM_TYPE_ICONS: Record<string, typeof FileText> = {
  document: FileText,
  artifact: Package,
  channel: MessageSquare,
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  document: "Document",
  artifact: "Artifact",
  channel: "Chat",
};

interface FolderItemListProps {
  items: FolderItem[];
  onRemove: (itemId: string) => void;
  removing?: string | null;
}

export function FolderItemList({ items, onRemove, removing }: FolderItemListProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground">No items in this folder</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {items.map((item) => {
        const Icon = ITEM_TYPE_ICONS[item.itemType] ?? FileText;
        return (
          <div
            key={item.id}
            className="flex items-center gap-3 border-b border-border last:border-0 px-4 py-3 hover:bg-muted/40"
          >
            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium truncate block">
                {item.displayName ?? item.id.slice(0, 12)}
              </span>
              <span className="text-xs text-muted-foreground">
                {ITEM_TYPE_LABELS[item.itemType] ?? item.itemType}
                {" · "}
                {timeAgo(item.addedAt)}
              </span>
            </div>
            <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
              {ITEM_TYPE_LABELS[item.itemType] ?? item.itemType}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              title="Remove item"
              disabled={removing === item.id}
              onClick={() => onRemove(item.id)}
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
