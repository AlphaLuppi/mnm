import { useState } from "react";
import { ActionButtonProps } from "@mnm/shared";
import { useBlockContext } from "./BlockRenderer";

import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Loader2, Check } from "lucide-react";
import { cn } from "../../lib/utils";


const VARIANT_MAP: Record<string, "default" | "destructive" | "outline" | "ghost"> = {
  default: "default",
  destructive: "destructive",
  outline: "outline",
  ghost: "ghost",
};

export function MnmActionButton({ props }: { props: typeof ActionButtonProps._type }) {
  const ctx = useBlockContext();
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [successFlash, setSuccessFlash] = useState(false);

  const isActioned = ctx?.isActioned ?? false;
  const noPermission = props.permission ? !ctx?.hasPermission(props.permission) : false;
  const isDisabled = loading || isActioned || noPermission;

  const execute = async () => {
    setLoading(true);
    try {
      await ctx?.onAction(props.action, props.payload ?? undefined);
      // Brief green success flash
      setSuccessFlash(true);
      setTimeout(() => setSuccessFlash(false), 1200);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = () => {
    if (props.confirm) {
      setShowConfirm(true);
    } else {
      execute();
    }
  };

  return (
    <>
      <Button
        variant={successFlash ? "outline" : VARIANT_MAP[props.variant ?? "default"]}
        size="sm"
        onClick={handleClick}
        disabled={isDisabled}
        title={noPermission ? "You don't have permission for this action" : undefined}
        className={cn(
          successFlash && "border-emerald-500 text-emerald-600 dark:text-emerald-400",
        )}
      >
        {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
        {successFlash && <Check className="mr-1.5 h-3.5 w-3.5" />}
        {props.label}
      </Button>

      {props.confirm && (
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmation</DialogTitle>
              <DialogDescription>{props.confirm}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
              <Button variant={props.variant === "destructive" ? "destructive" : "default"} onClick={() => { setShowConfirm(false); execute(); }}>
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
