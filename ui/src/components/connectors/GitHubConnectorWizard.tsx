import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink,
  GitBranch,
  KeyRound,
  Lock,
  Plug,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ApiError } from "@/api/client";
import {
  connectorsApi,
  type Connector,
  type ConnectorTemplate,
  type CreateConnectorPayload,
  type GitHubAppDetails,
} from "@/api/connectors";
import { queryKeys } from "@/lib/queryKeys";
import { useCompany } from "@/context/CompanyContext";
import {
  buildGitHubAppCreateUrl,
  buildGitHubAppInstallUrl,
  isValidAppId,
  looksLikePemPrivateKey,
  type WizardStep,
} from "./github-app-helpers";

/**
 * GITHUB-PROVIDER Phase 5 — adaptive wizard for the unified GitHub connector.
 *
 * D6 invariant : there is ONE template `github` in the grid. The OAuth setup is
 * step 1 ; the App configuration is OPTIONAL (steps 2 + 3a/b/c). The component
 * detects the current state of the connector (does it exist ? does it already
 * have an App config ?) and routes to the right step automatically.
 *
 * Surface :
 *   - Step 1 — OAuth credentials (Client ID + Client Secret) → POST /connectors
 *   - Step 2 — banner « configurer une App ou passer ? »
 *   - Step 3a — deep-link to github.com/settings/apps/new with preset query
 *   - Step 3b — paste appId + privateKey (+ webhookSecret?) → POST /github/app
 *   - Step 3c — deep-link to install on an org + SSE-driven installations list
 *
 * Used both by the «Add a connector» grid (when the github tile is clicked)
 * and by the connector detail Sheet (when the admin re-opens to add the App
 * later — in which case the wizard skips directly to step 3a).
 */

interface GitHubConnectorWizardProps {
  /**
   * The github template — required because the wizard reuses its scopes /
   * displayName for the OAuth POST. Sourced from `connectorsApi.templates(...)`.
   */
  template: ConnectorTemplate;
  /**
   * Existing github connector if one is already created. When set, step 1 is
   * skipped and the wizard opens on `app-banner` (or `app-create` if `entry`
   * forces it).
   */
  existingConnector?: Connector | null;
  /**
   * Optional override for the initial step — used by the Sheet when the admin
   * clicks « Configurer la App » directly to skip the banner.
   */
  entry?: WizardStep;
  /**
   * Called when the wizard reaches a terminal state (App configured or skip).
   * Parent should close any containing dialog.
   */
  onClose: () => void;
}

export function GitHubConnectorWizard({
  template,
  existingConnector,
  entry,
  onClose,
}: GitHubConnectorWizardProps) {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  // Wizard state — the active step + per-step form data.
  const [step, setStep] = useState<WizardStep>(() => {
    if (entry) return entry;
    if (existingConnector) return "app-banner";
    return "oauth-credentials";
  });
  const [connector, setConnector] = useState<Connector | null>(
    existingConnector ?? null,
  );

  // Step 1 form
  const [displayName, setDisplayName] = useState(template.displayName);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  // Step 3b form
  const [appId, setAppId] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");

  // ── Step 1 — create OAuth connector ────────────────────────────────────
  const createConnectorMutation = useMutation({
    mutationFn: (payload: CreateConnectorPayload) =>
      connectorsApi.create(selectedCompanyId!, payload),
    onSuccess: (next) => {
      setConnector(next);
      queryClient.invalidateQueries({
        queryKey: queryKeys.connectors.list(selectedCompanyId!),
      });
      setStep("app-banner");
    },
  });

  function submitOAuth() {
    if (!selectedCompanyId) return;
    createConnectorMutation.mutate({
      templateSlug: template.slug,
      displayName: displayName.trim() || template.displayName,
      scopes: template.scopes ?? [],
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
    });
  }

  // ── Step 3b — create the App config attached to the connector ──────────
  const createAppMutation = useMutation({
    mutationFn: () => {
      if (!selectedCompanyId || !connector) {
        throw new Error("Connector not yet created");
      }
      const payload: { appId: string; privateKey: string; webhookSecret?: string } = {
        appId: appId.trim(),
        privateKey: privateKey.trim(),
      };
      if (webhookSecret.trim().length > 0) {
        payload.webhookSecret = webhookSecret.trim();
      }
      return connectorsApi.createGitHubApp(
        selectedCompanyId,
        connector.id,
        payload,
      );
    },
    onSuccess: () => {
      if (selectedCompanyId && connector) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.connectors.githubApp(selectedCompanyId, connector.id),
        });
      }
      setStep("app-install");
    },
  });

  // ── Step 3c — poll-free installations list driven by SSE ───────────────
  const {
    data: appDetails,
    isLoading: isLoadingApp,
  } = useQuery({
    queryKey:
      selectedCompanyId && connector
        ? queryKeys.connectors.githubApp(selectedCompanyId, connector.id)
        : ["connectors", "noop"],
    queryFn: () =>
      connectorsApi.getGitHubApp(selectedCompanyId!, connector!.id),
    enabled: !!selectedCompanyId && !!connector && step === "app-install",
  });

  // Subscribe to the SSE-driven DOM event so the «Terminer» button enables
  // when an installation lands. The query above is also invalidated by the
  // LiveUpdatesProvider, so the data refreshes ; this listener is just a
  // belt-and-braces hook in case the consumer wants to react to the event
  // directly (e.g. confetti, focus shift).
  useEffect(() => {
    function onAdded() {
      // No-op : invalidation already handled centrally. Kept as an extension
      // point for future UX (toast, focus, etc.).
    }
    window.addEventListener("github_app_installation:added", onAdded);
    return () =>
      window.removeEventListener("github_app_installation:added", onAdded);
  }, []);

  // ── Step content ───────────────────────────────────────────────────────
  const oauthValid =
    displayName.trim().length > 0 &&
    clientId.trim().length > 0 &&
    clientSecret.trim().length > 0;

  const pasteValid =
    isValidAppId(appId) && looksLikePemPrivateKey(privateKey);

  const installationsCount = appDetails?.installations?.length ?? 0;

  return (
    <div className="space-y-4 py-2" data-testid="gh-app-wizard">
      <WizardStepIndicator step={step} hasExisting={!!existingConnector} />

      {step === "oauth-credentials" && (
        <div className="space-y-4" data-testid="gh-app-wizard-step-1">
          <Alert>
            <Plug className="h-4 w-4" />
            <AlertTitle>Étape 1 — OAuth GitHub</AlertTitle>
            <AlertDescription>
              Crée une OAuth App sur github.com/settings/developers, puis colle
              le Client ID et le Client Secret ci-dessous. Chaque utilisateur
              connectera ensuite son propre compte depuis ses paramètres.
            </AlertDescription>
          </Alert>
          <div className="space-y-1.5">
            <Label htmlFor="gh-display-name">Nom affiché</Label>
            <Input
              id="gh-display-name"
              data-testid="gh-app-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gh-client-id">Client ID</Label>
            <Input
              id="gh-client-id"
              data-testid="gh-app-client-id"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gh-client-secret">Client Secret</Label>
            <Input
              id="gh-client-secret"
              data-testid="gh-app-client-secret"
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
            />
          </div>
          <a
            href={template.docsUrl ?? "https://docs.github.com/en/apps/oauth-apps"}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:underline"
          >
            Configurer une OAuth app sur GitHub
            <ExternalLink className="h-3 w-3" />
          </a>

          {createConnectorMutation.error && (
            <p className="text-sm text-destructive">
              {(createConnectorMutation.error as Error).message}
            </p>
          )}

          <FooterActions
            onCancel={onClose}
            primary={
              <Button
                onClick={submitOAuth}
                disabled={!oauthValid || createConnectorMutation.isPending}
                data-testid="gh-app-oauth-submit"
              >
                {createConnectorMutation.isPending
                  ? "Création..."
                  : "Créer le connecteur"}
              </Button>
            }
          />
        </div>
      )}

      {step === "app-banner" && connector && (
        <div className="space-y-4" data-testid="gh-app-wizard-step-2">
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>Connecteur OAuth créé</AlertTitle>
            <AlertDescription>
              Tes utilisateurs peuvent maintenant connecter leur compte GitHub
              depuis Paramètres &gt; Comptes connectés. Pour aller plus loin,
              tu peux configurer une <b>GitHub App</b> per-company.
            </AlertDescription>
          </Alert>

          <div className="rounded-md border p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium">Pourquoi configurer une App ?</p>
                <p className="text-sm text-muted-foreground">
                  Pour accéder aux repos privées d'organisations GitHub
                  (notamment celles avec SSO SAML), une GitHub App offre des
                  scopes per-repo et un installation token serveur, sans passer
                  par l'OAuth user. C'est optionnel — tu peux le faire plus tard.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                onClick={() => setStep("app-create")}
                data-testid="gh-app-banner-configure"
              >
                <GitBranch className="h-4 w-4 mr-1" />
                Configurer la App
              </Button>
              <Button
                variant="ghost"
                onClick={onClose}
                data-testid="gh-app-banner-skip"
              >
                Plus tard
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === "app-create" && connector && (
        <AppCreateStep
          companyName={selectedCompany?.name ?? "company"}
          onContinue={() => setStep("app-paste")}
          onCancel={onClose}
        />
      )}

      {step === "app-paste" && connector && (
        <div className="space-y-4" data-testid="gh-app-wizard-step-3b">
          <Alert>
            <KeyRound className="h-4 w-4" />
            <AlertTitle>Étape 3 — Coller les credentials de la App</AlertTitle>
            <AlertDescription>
              Sur la page de la App fraîchement créée sur GitHub, copie l'App
              ID (en haut), génère une clé privée (.pem) et colle-la ci-dessous.
              Le webhook secret est optionnel.
            </AlertDescription>
          </Alert>

          <div className="space-y-1.5">
            <Label htmlFor="gh-app-id-input">App ID</Label>
            <Input
              id="gh-app-id-input"
              data-testid="gh-app-paste-app-id"
              placeholder="123456"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
            />
            {appId.length > 0 && !isValidAppId(appId) && (
              <p className="text-xs text-destructive">
                L'App ID est un nombre — vérifie ce que tu as copié.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gh-app-private-key">Clé privée (.pem)</Label>
            <Textarea
              id="gh-app-private-key"
              data-testid="gh-app-paste-private-key"
              rows={8}
              placeholder={
                "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
              }
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
            />
            {privateKey.length > 0 && !looksLikePemPrivateKey(privateKey) && (
              <p className="text-xs text-destructive">
                Format attendu : un bloc PEM commençant par
                <code className="mx-1">-----BEGIN</code>
                et terminant par
                <code className="mx-1">-----</code>.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gh-app-webhook-secret">
              Webhook secret (optionnel)
            </Label>
            <Input
              id="gh-app-webhook-secret"
              data-testid="gh-app-paste-webhook-secret"
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
            />
          </div>

          {createAppMutation.error && (
            <p className="text-sm text-destructive" data-testid="gh-app-paste-error">
              {appCreateErrorMessage(createAppMutation.error as Error)}
            </p>
          )}

          <FooterActions
            onCancel={onClose}
            secondary={
              <Button
                variant="ghost"
                onClick={() => setStep("app-create")}
                disabled={createAppMutation.isPending}
              >
                Retour
              </Button>
            }
            primary={
              <Button
                onClick={() => createAppMutation.mutate()}
                disabled={!pasteValid || createAppMutation.isPending}
                data-testid="gh-app-paste-submit"
              >
                {createAppMutation.isPending
                  ? "Validation..."
                  : "Créer la App"}
              </Button>
            }
          />
        </div>
      )}

      {step === "app-install" && connector && (
        <AppInstallStep
          appDetails={appDetails ?? null}
          isLoading={isLoadingApp}
          installationsCount={installationsCount}
          onFinish={onClose}
        />
      )}
    </div>
  );
}

/**
 * Step 3a — deep-link to github.com/settings/apps/new with preset query.
 * Pure presentational, no API calls.
 */
function AppCreateStep({
  companyName,
  onContinue,
  onCancel,
}: {
  companyName: string;
  onContinue: () => void;
  onCancel: () => void;
}) {
  const url = useMemo(
    () =>
      buildGitHubAppCreateUrl({
        origin: typeof window !== "undefined" ? window.location.origin : "",
        companyName,
      }),
    [companyName],
  );

  return (
    <div className="space-y-4" data-testid="gh-app-wizard-step-3a">
      <Alert>
        <GitBranch className="h-4 w-4" />
        <AlertTitle>Étape 3 — Créer la GitHub App</AlertTitle>
        <AlertDescription>
          Le bouton ci-dessous t'envoie sur GitHub avec un formulaire pré-rempli
          (nom, URL de callback, permissions). Vérifie que ces permissions sont
          cochées avant de cliquer « Create GitHub App » :
        </AlertDescription>
      </Alert>

      <div className="rounded-md border p-3 text-sm space-y-1">
        <PermissionLine label="Contents" value="Read & write" />
        <PermissionLine label="Metadata" value="Read-only" />
        <PermissionLine label="Pull requests" value="Read & write" />
        <PermissionLine label="Issues" value="Read & write" />
        <PermissionLine label="Actions" value="Read-only" />
      </div>

      <Button asChild data-testid="gh-app-create-deeplink">
        <a href={url} target="_blank" rel="noreferrer">
          <ExternalLink className="h-4 w-4 mr-1" />
          Ouvrir GitHub
        </a>
      </Button>

      <p className="text-xs text-muted-foreground">
        Une fois la App créée, GitHub te redirige sur la page « General » de la
        App. Note l'App ID et génère une clé privée (.pem) en bas de page, puis
        reviens ici.
      </p>

      <FooterActions
        onCancel={onCancel}
        primary={
          <Button onClick={onContinue} data-testid="gh-app-create-continue">
            J'ai créé la App
          </Button>
        }
      />
    </div>
  );
}

/**
 * Step 3c — install on an org + show the live list of installations.
 *
 * The list refreshes on SSE event `connector.github_app_installation_added`
 * (handled centrally in LiveUpdatesProvider — no polling here).
 */
function AppInstallStep({
  appDetails,
  isLoading,
  installationsCount,
  onFinish,
}: {
  appDetails: GitHubAppDetails | null;
  isLoading: boolean;
  installationsCount: number;
  onFinish: () => void;
}) {
  const installUrl = appDetails
    ? buildGitHubAppInstallUrl(appDetails.appSlug)
    : null;

  return (
    <div className="space-y-4" data-testid="gh-app-wizard-step-3c">
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Étape 4 — Installer la App sur une organisation</AlertTitle>
        <AlertDescription>
          La App est créée et validée. Installe-la maintenant sur les
          organisations dont tu veux gérer les repos privées. Cette page se
          met à jour en temps réel quand l'installation est terminée.
        </AlertDescription>
      </Alert>

      {installUrl && (
        <Button asChild data-testid="gh-app-install-deeplink">
          <a href={installUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4 mr-1" />
            Installer sur une organisation
          </a>
        </Button>
      )}

      <div className="rounded-md border p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">Installations actives</p>
          <Badge variant="outline">{installationsCount}</Badge>
        </div>
        {isLoading && (
          <p className="text-sm text-muted-foreground">Chargement...</p>
        )}
        {!isLoading && installationsCount === 0 && (
          <p className="text-sm text-muted-foreground">
            Aucune installation pour l'instant. Clique sur « Installer sur une
            organisation » pour commencer.
          </p>
        )}
        {!isLoading && installationsCount > 0 && (
          <ul className="space-y-2">
            {appDetails!.installations.map((inst) => (
              <li
                key={inst.installationId}
                data-testid={`gh-app-install-row-${inst.installationId}`}
                className="flex items-center justify-between text-sm"
              >
                <span>
                  <b>{inst.accountLogin}</b>{" "}
                  <span className="text-muted-foreground">
                    ({inst.accountType.toLowerCase()},{" "}
                    {inst.repositorySelection === "all"
                      ? "tous les repos"
                      : "repos sélectionnés"}
                    )
                  </span>
                </span>
                {inst.suspendedAt && (
                  <Badge variant="destructive">Suspendue</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <FooterActions
        onCancel={onFinish}
        primary={
          <Button
            onClick={onFinish}
            disabled={installationsCount === 0}
            data-testid="gh-app-finish"
          >
            Terminer
          </Button>
        }
      />
    </div>
  );
}

function FooterActions({
  onCancel,
  primary,
  secondary,
}: {
  onCancel: () => void;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  return (
    <>
      <Separator />
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} data-testid="gh-app-cancel">
          Annuler
        </Button>
        {secondary}
        {primary}
      </div>
    </>
  );
}

function WizardStepIndicator({
  step,
  hasExisting,
}: {
  step: WizardStep;
  hasExisting: boolean;
}) {
  // Skip step 1 in the indicator when the connector already exists ; step 1
  // is irrelevant in that flow.
  const steps: Array<{ id: WizardStep; label: string }> = hasExisting
    ? [
        { id: "app-banner", label: "App optionnelle" },
        { id: "app-create", label: "Créer" },
        { id: "app-paste", label: "Credentials" },
        { id: "app-install", label: "Installer" },
      ]
    : [
        { id: "oauth-credentials", label: "OAuth" },
        { id: "app-banner", label: "App optionnelle" },
        { id: "app-create", label: "Créer" },
        { id: "app-paste", label: "Credentials" },
        { id: "app-install", label: "Installer" },
      ];
  const activeIdx = steps.findIndex((s) => s.id === step);
  return (
    <ol className="flex items-center gap-2 text-xs text-muted-foreground">
      {steps.map((s, idx) => (
        <li
          key={s.id}
          className={
            idx === activeIdx
              ? "text-foreground font-medium"
              : idx < activeIdx
                ? "text-foreground/70"
                : ""
          }
          data-testid={`gh-app-step-indicator-${s.id}`}
        >
          {idx + 1}. {s.label}
          {idx < steps.length - 1 && <span className="mx-2">›</span>}
        </li>
      ))}
    </ol>
  );
}

function PermissionLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}

function appCreateErrorMessage(err: Error): string {
  if (err instanceof ApiError) {
    if (err.status === 422) {
      return "Validation refusée par GitHub. Vérifie que la clé privée est intacte (sans modification depuis le copier/coller) et que l'App ID correspond.";
    }
    return err.message;
  }
  return err.message;
}
