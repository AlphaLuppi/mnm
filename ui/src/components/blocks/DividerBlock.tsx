import type { DividerBlock as DividerBlockType } from "@mnm/shared";
import type { BlockContext } from "./BlockRenderer";
import { Separator } from "@/components/ui/separator";

export function DividerBlock(_props: { block: DividerBlockType; context: BlockContext }) {
  return <Separator className="my-3" />;
}
