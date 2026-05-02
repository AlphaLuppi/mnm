import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plug,
  KeyRound,
  Link2,
  Link2Off,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { connectorsApi, type MyConnectedAccount } from "../api/connectors";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * CONNECTORS-PLATFORM Sprint 2 — Task 7 UI user.
 *
 * Page utilisateur pour connecter / déconnecter les comptes externes.
 * - oauth2 : ouvre l'URL `authorizeUrl` dans une popup, écoute la fermeture,
 *   refetch myAccounts pour confirmer le statut.
 * - api_key : Dialog avec input password type, POST /me/api-key.
 *
 * Le SSE event `user.connector_status_changed` (Task 8) déclenchera une
 * invalidation automatique de la queryKey myAccounts. En attendant, le polling
 * passif de focus déclenche un refetch (TanStack default behavior — refetchOnWindowFocus).
 */

export function SettingsAccounts() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const [apiKeyDialog, setApiKeyDialog] = useState<MyConnectedAccount | null>(null);
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [disconnectTarget, setDisconnectTarget] = useState<MyConnectedAccount | null>(
    null,
  );

  useEffect(() => {
    setBreadcrumbs([{ label: "Paramètres" }, { label: "Comptes connectés" }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.connectors.myAccounts(selectedCompanyId!),
    queryFn: () => connectorsApi.myAccounts(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const accounts = useMemo(() => data?.accounts ?? [], [data]);

  const startConnectMutation = useMutation({
    mutationFn: (connectorId: string) =>
      connectorsApi.startConnect(selectedCompanyId!, connectorId, "/settings/accounts"),
    onSuccess: ({ authorizeUrl }) => {
      // Open the OAuth flow in a popup. The provider redirects back to
      // /api/connectors/callback (server side, NON tenant-scoped) which
      // upserts the token, then redirects to /settings/accounts. The popup
      // closes automatically after that final navigation; we listen for the
      // close event and refetch.
      const popup = window.open(
        authorizeUrl,
        "mnm-oauth",
        "width=600,height=720,menubar=no,toolbar=no",
      );
      if (!popup) {
        // Popup blocked — fallback to full-page redirect.
        window.location.assign(authorizeUrl);
        return;
      }
      const checkClosed = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(checkClosed);
          queryClient.invalidateQueries({
            queryKey: queryKeys.connectors.myAccounts(selectedCompanyId!),
          });
        }
      }, 500);
    },
  });

  const setApiKeyMutation = useMutation({
    mutationFn: ({ connectorId, key }: { connectorId: string; key: string }) =>
      connectorsApi.setApiKey(selectedCompanyId!, connectorId, key),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.connectors.myAccounts(selectedCompanyId!),
      });
      setApiKeyDialog(null);
      setApiKeyValue("");
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (connectorId: string) =>
      connectorsApi.disconnect(selectedCompanyId!, connectorId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.connectors.myAccounts(selectedCompanyId!),
      });
      setDisconnectTarget(null);
    },
  });

  if (!selectedCompanyId || isLoading) return <PageSkeleton />;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Link2 className="h-6 w-6" />
          Mes comptes connectés
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connecte tes comptes externes (Jira, GitHub, OpenAI, etc.) pour permettre
          aux agents et hooks d'agir en ton nom. Chaque jeton est chiffré
          (AES-256-GCM) et n'est jamais transmis aux agents — il reste côté
          serveur.
        </p>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Plug}
          message="Aucun connecteur disponible. Demande à un administrateur de configurer un connecteur depuis Admin > Connecteurs pour pouvoir y connecter ton compte."
        />
      ) : (
        <div className="grid gap-3">
          {accounts.map((acc) => (
            <AccountRow
              key={acc.id}
              account={acc}
              onConnect={() => startConnectMutation.mutate(acc.id)}
              onSetApiKey={() => setApiKeyDialog(acc)}
              onDisconnect={() => setDisconnectTarget(acc)}
              connecting={startConnectMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* API key dialog */}
      <Dialog
        open={!!apiKeyDialog}
        onOpenChange={(o) => {
          if (!o) {
            setApiKeyDialog(null);
            setApiKeyValue("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connecter {apiKeyDialog?.displayName}</DialogTitle>
            <DialogDescription>
              Colle ta clé API ({apiKeyDialog?.apiKeyLabel ?? "API key"}). Elle
              sera chiffrée avant stockage et ne sera jamais affichée en clair.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="apiKey">Clé API</Label>
            <Input
              id="apiKey"
              type="password"
              autoComplete="off"
              data-testid="settings-accounts-api-key-input"
              value={apiKeyValue}
              onChange={(e) => setApiKeyValue(e.target.value)}
              placeholder={apiKeyDialog?.apiKeyLabel ?? "sk-..."}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setApiKeyDialog(null);
                setApiKeyValue("");
              }}
              disabled={setApiKeyMutation.isPending}
            >
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (apiKeyDialog && apiKeyValue.trim()) {
                  setApiKeyMutation.mutate({
                    connectorId: apiKeyDialog.id,
                    key: apiKeyValue.trim(),
                  });
                }
              }}
              disabled={!apiKeyValue.trim() || setApiKeyMutation.isPending}
              data-testid="settings-accounts-api-key-submit"
            >
              {setApiKeyMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect confirmation */}
      <Dialog
        open={!!disconnectTarget}
        onOpenChange={(o) => !o && setDisconnectTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Déconnecter {disconnectTarget?.displayName} ?</DialogTitle>
            <DialogDescription>
              Le jeton sera supprimé du serveur. Tu pourras te reconnecter à tout
              moment. Les hooks qui utilisent ce connecteur en ton nom cesseront
              de fonctionner jusqu'à reconnexion.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDisconnectTarget(null)}
              disabled={disconnectMutation.isPending}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                disconnectTarget && disconnectMutation.mutate(disconnectTarget.id)
              }
              disabled={disconnectMutation.isPending}
              data-testid="settings-accounts-disconnect-confirm"
            >
              {disconnectMutation.isPending ? "Déconnexion..." : "Déconnecter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountRow({
  account,
  onConnect,
  onSetApiKey,
  onDisconnect,
  connecting,
}: {
  account: MyConnectedAccount;
  onConnect: () => void;
  onSetApiKey: () => void;
  onDisconnect: () => void;
  connecting: boolean;
}) {
  const isApiKey = account.type === "api_key";
  const Icon = isApiKey ? KeyRound : Plug;

  let statusBadge;
  switch (account.status) {
    case "connected":
      statusBadge = (
        <Badge variant="default" className="gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Connecté
        </Badge>
      );
      break;
    case "expired":
      statusBadge = (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          Expiré (refresh auto)
        </Badge>
      );
      break;
    case "revoked":
      statusBadge = (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Révoqué — reconnecte
        </Badge>
      );
      break;
    default:
      statusBadge = <Badge variant="outline">Non connecté</Badge>;
  }

  const showConnect =
    !isApiKey && (account.status === "disconnected" || account.status === "revoked");
  const showSetKey =
    isApiKey && (account.status === "disconnected" || account.status === "revoked");
  const showDisconnect =
    account.status === "connected" || account.status === "expired";

  return (
    <Card data-testid={`settings-accounts-row-${account.providerSlug}`}>
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium">{account.displayName}</p>
            <p className="text-xs text-muted-foreground">
              {account.providerSlug}
              {account.status === "connected" && account.scopesGranted.length > 0
                ? ` · ${account.scopesGranted.length} scopes`
                : ""}
              {account.expiresAt
                ? ` · expire le ${new Date(account.expiresAt).toLocaleDateString()}`
                : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {statusBadge}
          {!account.enabled && (
            <Badge variant="outline" className="text-xs">
              Désactivé par admin
            </Badge>
          )}
          {showConnect && (
            <Button
              size="sm"
              onClick={onConnect}
              disabled={connecting || !account.enabled}
              data-testid={`settings-accounts-connect-${account.providerSlug}`}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              {connecting ? "Ouverture..." : "Connecter"}
            </Button>
          )}
          {showSetKey && (
            <Button
              size="sm"
              onClick={onSetApiKey}
              disabled={!account.enabled}
              data-testid={`settings-accounts-set-key-${account.providerSlug}`}
            >
              <KeyRound className="h-4 w-4 mr-1" />
              Définir la clé
            </Button>
          )}
          {showDisconnect && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onDisconnect}
              data-testid={`settings-accounts-disconnect-${account.providerSlug}`}
            >
              <Link2Off className="h-4 w-4 mr-1" />
              Déconnecter
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
