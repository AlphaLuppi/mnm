import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Copy,
  ExternalLink,
  GitBranch,
  Plug,
  RefreshCw,
  ShieldOff,
  Trash2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  connectorsApi,
  type Connector,
  type ConnectorTemplate,
} from "@/api/connectors";
import { queryKeys } from "@/lib/queryKeys";
import { useCompany } from "@/context/CompanyContext";
import { GitHubConnectorWizard } from "./GitHubConnectorWizard";
import {
  buildGitHubAppInstallUrl,
  buildInstallationViewUrl,
} from "./github-app-helpers";

/**
 * GITHUB-PROVIDER Phase 5 — connector detail Sheet for the unified `github`
 * connector. Two stacked sections :
 *
 *   - OAuth (always visible, read-only)   — Client ID, redirect URL, status
 *   - App (optional)                       — config + installations management
 *
 * If no App config exists, the App section shows a banner with « Configurer
 * la App » that opens the wizard at step 3a (skipping the OAuth step). If
 * the App is configured, we display its `appId` / `appSlug`, the list of
 * active installations with deep-links to GitHub, and a Désinstaller dialog.
 *
 * Real-time : the App query is centrally invalidated by the
 * LiveUpdatesProvider on `connector.github_app_installation_added`. No polling.
 */

interface GitHubConnectorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connector: Connector;
  template: ConnectorTemplate;
}

export function GitHubConnectorSheet({
  open,
  onOpenChange,
  connector,
  template,
}: GitHubConnectorSheetProps) {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [showWizard, setShowWizard] = useState(false);
  const [confirmUninstall, setConfirmUninstall] = useState(false);

  const { data: appDetails, isLoading } = useQuery({
    queryKey: queryKeys.connectors.githubApp(selectedCompanyId!, connector.id),
    queryFn: () => connectorsApi.getGitHubApp(selectedCompanyId!, connector.id),
    enabled: !!selectedCompanyId && open,
  });

  const syncMutation = useMutation({
    mutationFn: () =>
      connectorsApi.syncGitHubAppInstallations(
        selectedCompanyId!,
        connector.id,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.connectors.githubApp(
          selectedCompanyId!,
          connector.id,
        ),
      });
    },
  });

  const deleteAppMutation = useMutation({
    mutationFn: () =>
      connectorsApi.deleteGitHubApp(selectedCompanyId!, connector.id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.connectors.githubApp(
          selectedCompanyId!,
          connector.id,
        ),
      });
      setConfirmUninstall(false);
    },
  });

  const redirectUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/connectors/callback`
      : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="sm:max-w-xl overflow-y-auto"
        data-testid="gh-app-sheet"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            {connector.displayName}
          </SheetTitle>
          <SheetDescription>
            Connecteur GitHub — OAuth utilisateur + GitHub App optionnelle pour
            les organisations privées.
          </SheetDescription>
        </SheetHeader>

        {showWizard ? (
          <div className="px-4 pb-4">
            <GitHubConnectorWizard
              template={template}
              existingConnector={connector}
              entry="app-create"
              onClose={() => setShowWizard(false)}
            />
          </div>
        ) : (
          <div className="px-4 pb-4 space-y-6">
            {/* ── OAuth section ─────────────────────────────────────────── */}
            <section data-testid="gh-app-sheet-oauth-section" className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">OAuth</h3>
                <Badge
                  variant={
                    connector.clientSecretConfigured ? "default" : "outline"
                  }
                >
                  {connector.clientSecretConfigured
                    ? "Configuré"
                    : "Non configuré"}
                </Badge>
              </div>

              <ReadOnlyField label="Client ID" value={connector.clientId ?? "—"} />
              <ReadOnlyField label="Redirect URL" value={redirectUrl} />
              <ReadOnlyField
                label="Scopes"
                value={
                  connector.scopes && connector.scopes.length > 0
                    ? connector.scopes.join(", ")
                    : "—"
                }
              />
            </section>

            <Separator />

            {/* ── App section ──────────────────────────────────────────── */}
            <section data-testid="gh-app-sheet-app-section" className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">GitHub App (optionnelle)</h3>
                {appDetails && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                    data-testid="gh-app-sheet-sync"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    {syncMutation.isPending ? "Sync..." : "Resynchroniser"}
                  </Button>
                )}
              </div>

              {isLoading && (
                <p className="text-sm text-muted-foreground">Chargement...</p>
              )}

              {!isLoading && !appDetails && (
                <Alert data-testid="gh-app-sheet-app-empty">
                  <GitBranch className="h-4 w-4" />
                  <AlertTitle>Aucune App configurée</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>
                      Configure une GitHub App per-company pour accéder aux
                      repos privées d'organisations GitHub avec un installation
                      token serveur (sans passer par l'OAuth user).
                    </p>
                    <Button
                      size="sm"
                      onClick={() => setShowWizard(true)}
                      data-testid="gh-app-sheet-configure"
                    >
                      <GitBranch className="h-4 w-4 mr-1" />
                      Configurer la App
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {!isLoading && appDetails && (
                <div className="space-y-3">
                  <ReadOnlyField label="App ID" value={appDetails.appId} />
                  <ReadOnlyField label="App Slug" value={appDetails.appSlug} />
                  <ReadOnlyField
                    label="Créée le"
                    value={new Date(appDetails.createdAt).toLocaleDateString()}
                  />

                  <p
                    className="text-xs text-muted-foreground"
                    data-testid="gh-app-unverified-notice"
                  >
                    Note : les commits effectués via la App apparaîtront comme
                    « Unverified » dans l'UI GitHub (badge gris). C'est attendu
                    — la traçabilité MnM (author = committer = l'utilisateur)
                    prime sur le badge. La signature GPG est prévue en V1.
                  </p>

                  <div className="rounded-md border">
                    <div className="px-3 py-2 border-b flex items-center justify-between">
                      <p className="text-sm font-medium">
                        Installations actives
                      </p>
                      <Badge variant="outline">
                        {appDetails.installations.length}
                      </Badge>
                    </div>
                    {appDetails.installations.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground space-y-2">
                        <p>
                          La App n'est installée sur aucune organisation. Tu
                          peux l'installer depuis GitHub :
                        </p>
                        <Button asChild size="sm" variant="outline">
                          <a
                            href={buildGitHubAppInstallUrl(appDetails.appSlug)}
                            target="_blank"
                            rel="noreferrer"
                            data-testid="gh-app-sheet-install-empty"
                          >
                            <ExternalLink className="h-3.5 w-3.5 mr-1" />
                            Installer sur une organisation
                          </a>
                        </Button>
                      </div>
                    ) : (
                      <ul className="divide-y">
                        {appDetails.installations.map((inst) => (
                          <li
                            key={inst.installationId}
                            data-testid={`gh-app-installation-row-${inst.installationId}`}
                            className="px-3 py-2 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {inst.accountLogin}
                                {inst.suspendedAt && (
                                  <Badge
                                    variant="destructive"
                                    className="ml-2 text-xs"
                                  >
                                    Suspendue
                                  </Badge>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {inst.accountType.toLowerCase()} ·{" "}
                                {inst.repositorySelection === "all"
                                  ? "tous les repos"
                                  : "repos sélectionnés"}{" "}
                                · ajouté le{" "}
                                {new Date(inst.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <Button
                              asChild
                              size="sm"
                              variant="ghost"
                              data-testid="gh-app-install-view-on-github"
                            >
                              <a
                                href={buildInstallationViewUrl(
                                  inst.accountType,
                                  inst.accountLogin,
                                  inst.installationId,
                                )}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                <span className="sr-only">Voir sur GitHub</span>
                              </a>
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowWizard(true)}
                      data-testid="gh-app-reconfigure"
                    >
                      <GitBranch className="h-4 w-4 mr-1" />
                      Reconfigurer
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setConfirmUninstall(true)}
                      data-testid="gh-app-uninstall"
                    >
                      <ShieldOff className="h-4 w-4 mr-1" />
                      Désinstaller la App
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </SheetContent>

      {/* Désinstaller confirm */}
      <Dialog open={confirmUninstall} onOpenChange={setConfirmUninstall}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Désinstaller la GitHub App ?
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <span>
                MnM va supprimer la configuration de la App (App ID, clé
                privée chiffrée, installations) et révoquer le cache des
                installation tokens. L'OAuth utilisateur reste actif —
                seul le mode App per-org est désactivé.
              </span>
              <span className="block pt-2">
                Important : cette action ne désinstalle PAS la App côté
                GitHub. Pour la retirer définitivement de tes organisations,
                tu dois aussi le faire depuis github.com.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmUninstall(false)}
              disabled={deleteAppMutation.isPending}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteAppMutation.mutate()}
              disabled={deleteAppMutation.isPending}
              data-testid="gh-app-uninstall-confirm"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {deleteAppMutation.isPending
                ? "Suppression..."
                : "Désinstaller"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  function copy() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(value);
    }
  }
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-muted/50 rounded px-2 py-1 truncate">
          {value}
        </code>
        {value !== "—" && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={copy}
          >
            <Copy className="h-3.5 w-3.5" />
            <span className="sr-only">Copier {label}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
