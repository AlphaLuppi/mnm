import { useState } from "react";
import { ActionButtonProps } from "@mnm/shared";
import { useBlockContext } from "./BlockRenderer";

import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Loader2 } from "lucide-react";


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

  const execute = async () => {
    setLoading(true);
    try {
      await ctx?.onAction(props.action, props.payload ?? undefined);
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
        variant={VARIANT_MAP[props.variant ?? "default"]}
        size="sm"
        onClick={handleClick}
        disabled={loading}
      >
        {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
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
