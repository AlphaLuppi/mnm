import { useState } from "react";
import { CheckCircle2, XCircle, Clock, FileText, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { HitlDecision } from "@mnm/shared";

export interface ValidationBannerProps {
  stageId: string;
  stageName: string;
  requestedAt: string;
  requestedBy?: string;
  outputArtifacts: string[];
  hitlHistory: HitlDecision[];
  canApproveOrReject: boolean;
  onApprove: (stageId: string, comment?: string) => Promise<void>;
  onReject: (stageId: string, feedback: string) => Promise<void>;
  isLoading?: boolean;
}

export function ValidationBanner({
  stageId,
  stageName,
  requestedAt,
  requestedBy,
  outputArtifacts,
  hitlHistory,
  canApproveOrReject,
  onApprove,
  onReject,
  isLoading = false,
}: ValidationBannerProps) {
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [approveComment, setApproveComment] = useState("");
  const [rejectFeedback, setRejectFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const rejectCount = hitlHistory.filter((d) => d.decision === "rejected").length;

  async function handleApproveConfirm() {
    setSubmitting(true);
    try {
      await onApprove(stageId, approveComment || undefined);
      setShowApproveDialog(false);
      setApproveComment("");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRejectConfirm() {
    setSubmitting(true);
    try {
      await onReject(stageId, rejectFeedback);
      setShowRejectDialog(false);
      setRejectFeedback("");
    } finally {
      setSubmitting(false);
    }
  }

  // Read-only banner for non-authorized roles
  if (!canApproveOrReject) {
    return (
      <div
        data-testid="orch-s03-validation-readonly-banner"
        className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 space-y-2"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
            En attente de validation
          </span>
        </div>
        <div className="text-sm text-muted-foreground">
          <span data-testid="orch-s03-validation-banner-stage-name">{stageName}</span>
          {" est en attente d'approbation par un administrateur."}
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        data-testid="orch-s03-validation-banner"
        className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Validation requise
            </span>
          </div>
          {rejectCount > 0 && (
            <span className="text-xs text-red-600 dark:text-red-400">
              {rejectCount} rejet(s) precedent(s)
            </span>
          )}
        </div>

        <div className="space-y-1 text-sm text-muted-foreground">
          <div>
            Etape : <span data-testid="orch-s03-validation-banner-stage-name" className="font-medium text-foreground">{stageName}</span>
          </div>
          <div>
            Demande : <span data-testid="orch-s03-validation-banner-requested-at">{new Date(requestedAt).toLocaleString()}</span>
          </div>
          {requestedBy && (
            <div>
              Par : <span data-testid="orch-s03-validation-banner-requested-by">{requestedBy}</span>
            </div>
          )}
        </div>

        {outputArtifacts.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Outputs produits :</span>
            <ul data-testid="orch-s03-output-artifacts-list" className="space-y-0.5">
              {outputArtifacts.map((artifact) => (
                <li
                  key={artifact}
                  data-testid="orch-s03-output-artifact-item"
                  className="flex items-center gap-1 text-xs text-muted-foreground"
                >
                  <FileText className="h-3 w-3" />
                  {artifact}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button
            data-testid="orch-s03-approve-btn"
            size="sm"
            variant="default"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => setShowApproveDialog(true)}
            disabled={isLoading}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Approuver
          </Button>
          <Button
            data-testid="orch-s03-reject-btn"
            size="sm"
            variant="destructive"
            onClick={() => setShowRejectDialog(true)}
            disabled={isLoading}
          >
            <XCircle className="h-3.5 w-3.5 mr-1" />
            Rejeter
          </Button>
        </div>
      </div>

      {/* Approve dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent data-testid="orch-s03-approve-dialog">
          <DialogHeader>
            <DialogTitle>Approuver "{stageName}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">
              Commentaire (optionnel)
            </label>
            <Textarea
              data-testid="orch-s03-approve-comment-input"
              placeholder="Ajoutez un commentaire..."
              value={approveComment}
              onChange={(e) => setApproveComment(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApproveDialog(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              data-testid="orch-s03-approve-confirm-btn"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleApproveConfirm}
              disabled={submitting}
            >
              Confirmer l'approbation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent data-testid="orch-s03-reject-dialog">
          <DialogHeader>
            <DialogTitle>Rejeter "{stageName}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">
              Feedback (obligatoire)
            </label>
            <Textarea
              data-testid="orch-s03-reject-feedback-input"
              placeholder="Expliquez pourquoi vous rejetez cette etape..."
              value={rejectFeedback}
              onChange={(e) => setRejectFeedback(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button
              data-testid="orch-s03-reject-cancel-btn"
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              data-testid="orch-s03-reject-confirm-btn"
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={submitting || !rejectFeedback.trim()}
            >
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
