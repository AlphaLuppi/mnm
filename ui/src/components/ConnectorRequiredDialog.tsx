import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plug, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ConnectorRequiredDetail } from "@/api/client";
import { useCompany } from "@/context/CompanyContext";

/**
 * Listens for `connector:required` CustomEvents emitted by the API client when
 * the backend returns a 412 with details.code === "CONNECTOR_REQUIRED" (strict
 * mode for user-level connectors). Surfaces a single Dialog and routes the user
 * to /settings/accounts with the relevant connector card highlighted.
 *
 * Mounted once at the App level, inside CompanyContext + Router.
 */
export function ConnectorRequiredDialog() {
  const [detail, setDetail] = useState<ConnectorRequiredDetail | null>(null);
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();

  useEffect(() => {
    function onRequired(e: Event) {
      const next = (e as CustomEvent<ConnectorRequiredDetail>).detail;
      // Only show the latest event — overwrites a stale one. React Query may
      // fire several failed queries on the same mutation; the user only needs
      // to act once.
      setDetail(next);
    }
    window.addEventListener("connector:required", onRequired as EventListener);
    return () => {
      window.removeEventListener(
        "connector:required",
        onRequired as EventListener,
      );
    };
  }, []);

  if (!detail) return null;

  const label = detail.connectorLabel ?? detail.connectorSlug;

  function handleConfigure() {
    if (!detail) return;
    const prefix = selectedCompany?.issuePrefix;
    const target = prefix
      ? `/${prefix}${detail.connectFlowUrl}`
      : detail.connectFlowUrl;
    setDetail(null);
    navigate(target);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && setDetail(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            Connecteur {label} requis
          </DialogTitle>
          <DialogDescription>
            Cette action a besoin d'un token utilisateur sur <b>{label}</b> pour
            s'exécuter sous ton identité (et pas en mode anonyme/company).
            Connecte ton compte {label} depuis tes paramètres pour continuer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setDetail(null)}>
            Annuler
          </Button>
          <Button onClick={handleConfigure}>
            <ExternalLink className="h-4 w-4 mr-1" />
            Configurer maintenant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
