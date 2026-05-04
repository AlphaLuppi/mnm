import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plug, Plus, Trash2, ExternalLink, KeyRound, Wrench, Info, Settings2 } from "lucide-react";
import {
  connectorsApi,
  type Connector,
  type ConnectorTemplate,
  type ConnectorType,
  type CreateConnectorPayload,
} from "../api/connectors";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
import { GitHubConnectorWizard } from "../components/connectors/GitHubConnectorWizard";
import { GitHubConnectorSheet } from "../components/connectors/GitHubConnectorSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type WizardMode = "template" | "custom";
type WizardStep = "basics" | "endpoints" | "details" | "credentials";

interface WizardState {
  open: boolean;
  mode: WizardMode;
  template: ConnectorTemplate | null;
  step: WizardStep;
  // shared
  type: ConnectorType;
  displayName: string;
  scopes: string[];
  clientId: string;
  clientSecret: string;
  apiKeyLabel: string;
  // custom-only
  providerSlug: string;
  authorizationUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  redirectUri: string;
  scopesText: string;
  refreshSupported: boolean;
}

const wizardInitial: WizardState = {
  open: false,
  mode: "template",
  template: null,
  step: "details",
  type: "oauth2",
  displayName: "",
  scopes: [],
  clientId: "",
  clientSecret: "",
  apiKeyLabel: "",
  providerSlug: "",
  authorizationUrl: "",
  tokenUrl: "",
  userinfoUrl: "",
  redirectUri: "",
  scopesText: "",
  refreshSupported: true,
};

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

function splitScopes(input: string): string[] {
  return input
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function Connectors() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"mine" | "add">("mine");
  const [wizard, setWizard] = useState<WizardState>(wizardInitial);
  const [deleteTarget, setDeleteTarget] = useState<Connector | null>(null);
  // GITHUB-PROVIDER Phase 5 — separate wizard state for the github tile so we
  // can dispatch to the dedicated GitHubConnectorWizard (D6 : single tile,
  // adaptive flow that handles OAuth + optional GitHub App).
  const [githubWizardTemplate, setGithubWizardTemplate] = useState<ConnectorTemplate | null>(null);
  const [githubSheet, setGithubSheet] = useState<{
    connector: Connector;
    template: ConnectorTemplate;
  } | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Admin" }, { label: "Connecteurs" }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);

  const { data: connectorsData, isLoading: isLoadingConnectors } = useQuery({
    queryKey: queryKeys.connectors.list(selectedCompanyId!),
    queryFn: () => connectorsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: templatesData } = useQuery({
    queryKey: queryKeys.connectors.templates(selectedCompanyId!),
    queryFn: () => connectorsApi.templates(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const connectors = useMemo(
    () => connectorsData?.connectors ?? [],
    [connectorsData],
  );
  const templates = useMemo(() => templatesData?.templates ?? [], [templatesData]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateConnectorPayload) =>
      connectorsApi.create(selectedCompanyId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.connectors.list(selectedCompanyId!),
      });
      setWizard(wizardInitial);
      setActiveTab("mine");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      connectorsApi.update(selectedCompanyId!, id, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.connectors.list(selectedCompanyId!),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => connectorsApi.remove(selectedCompanyId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.connectors.list(selectedCompanyId!),
      });
      setDeleteTarget(null);
    },
  });

  function openWizardFromTemplate(template: ConnectorTemplate) {
    // GITHUB-PROVIDER Phase 5 (D6) — github gets its own adaptive wizard that
    // handles the optional App configuration after OAuth setup. The single
    // template tile in the grid is preserved ; only the wizard differs.
    if (template.slug === "github") {
      setGithubWizardTemplate(template);
      return;
    }
    setWizard({
      ...wizardInitial,
      open: true,
      mode: "template",
      template,
      step: "details",
      type: template.type,
      displayName: template.displayName,
      scopes: [...(template.scopes ?? [])],
      apiKeyLabel: template.apiKeyLabel ?? "",
    });
  }

  /**
   * GITHUB-PROVIDER Phase 5 — open the GitHub-specific Sheet for an existing
   * connector. Callers : the « Configurer » button on the github row.
   */
  function openGithubSheet(connector: Connector) {
    const template = templates.find((t) => t.slug === "github");
    if (!template) return;
    setGithubSheet({ connector, template });
  }

  function openCustomWizard() {
    setWizard({
      ...wizardInitial,
      open: true,
      mode: "custom",
      step: "basics",
    });
  }

  function submitWizard() {
    if (wizard.mode === "template") {
      if (!wizard.template) return;
      const payload: CreateConnectorPayload = {
        templateSlug: wizard.template.slug,
        displayName: wizard.displayName.trim() || wizard.template.displayName,
        scopes: wizard.scopes,
      };
      if (wizard.template.type === "oauth2") {
        payload.clientId = wizard.clientId.trim();
        payload.clientSecret = wizard.clientSecret.trim();
      } else {
        payload.apiKeyLabel = wizard.apiKeyLabel.trim();
      }
      createMutation.mutate(payload);
      return;
    }

    // custom mode
    const payload: CreateConnectorPayload = {
      providerSlug: wizard.providerSlug.trim(),
      displayName: wizard.displayName.trim(),
      type: wizard.type,
    };
    if (wizard.type === "oauth2") {
      payload.authorizationUrl = wizard.authorizationUrl.trim() || null;
      payload.tokenUrl = wizard.tokenUrl.trim() || null;
      payload.userinfoUrl = wizard.userinfoUrl.trim() || null;
      payload.redirectUri = wizard.redirectUri.trim() || null;
      payload.scopes = splitScopes(wizard.scopesText);
      payload.refreshSupported = wizard.refreshSupported;
      payload.clientId = wizard.clientId.trim();
      payload.clientSecret = wizard.clientSecret.trim();
    } else {
      payload.apiKeyLabel = wizard.apiKeyLabel.trim();
    }
    createMutation.mutate(payload);
  }

  if (!selectedCompanyId) return <PageSkeleton />;
  if (isLoadingConnectors) return <PageSkeleton />;

  const slugValid =
    wizard.mode === "template" || SLUG_RE.test(wizard.providerSlug.trim());

  const canSubmitWizard = (() => {
    if (wizard.mode === "template") {
      return wizard.template?.type === "api_key"
        ? wizard.displayName.trim().length > 0 && wizard.apiKeyLabel.trim().length > 0
        : wizard.displayName.trim().length > 0 &&
          wizard.clientId.trim().length > 0 &&
          wizard.clientSecret.trim().length > 0;
    }
    // custom
    if (!slugValid || wizard.displayName.trim().length === 0) return false;
    if (wizard.type === "api_key") {
      return wizard.apiKeyLabel.trim().length > 0;
    }
    return (
      wizard.authorizationUrl.trim().length > 0 &&
      wizard.tokenUrl.trim().length > 0 &&
      wizard.clientId.trim().length > 0 &&
      wizard.clientSecret.trim().length > 0
    );
  })();

  const customBasicsValid =
    slugValid &&
    wizard.providerSlug.trim().length > 0 &&
    wizard.displayName.trim().length > 0;

  const customEndpointsValid =
    wizard.type === "api_key" ||
    (wizard.authorizationUrl.trim().length > 0 && wizard.tokenUrl.trim().length > 0);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Plug className="h-6 w-6" />
            Connecteurs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure les connecteurs OAuth et API key utilisés par les hooks et les
            agents au nom des utilisateurs de la company.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "mine" | "add")}>
        <TabsList>
          <TabsTrigger value="mine" data-testid="connectors-tab-mine">
            Mes connecteurs ({connectors.length})
          </TabsTrigger>
          <TabsTrigger value="add" data-testid="connectors-tab-add">
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="mt-6">
          {connectors.length === 0 ? (
            <EmptyState
              icon={Plug}
              message="Aucun connecteur configuré. Ajoute-en un depuis l'onglet « Ajouter » pour permettre aux utilisateurs de connecter leur compte Jira, GitHub, OpenAI, etc."
              action="Ajouter un connecteur"
              onAction={() => setActiveTab("add")}
            />
          ) : (
            <div className="grid gap-4">
              {connectors.map((c) => (
                <ConnectorRow
                  key={c.id}
                  connector={c}
                  onToggleEnabled={(enabled) =>
                    updateMutation.mutate({ id: c.id, enabled })
                  }
                  onDelete={() => setDeleteTarget(c)}
                  onConfigure={
                    c.providerSlug === "github"
                      ? () => openGithubSheet(c)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="add" className="mt-6 space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">
              Connecteur custom
            </h2>
            <Card
              className="cursor-pointer hover:border-primary transition-colors border-dashed"
              onClick={openCustomWizard}
              data-testid="connectors-template-custom"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    OAuth 2.0 / API Key custom
                  </CardTitle>
                  <Badge variant="outline">Avancé</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">
                  N'importe quelle API qui suit OAuth 2.0 (RFC 6749) ou un Bearer
                  token / API key. Tu fournis les URLs d'authorize / token et les
                  scopes — le serveur fait le reste.
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">
              Templates pré-configurés
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((t) => (
                <TemplateCard
                  key={t.slug}
                  template={t}
                  onClick={() => openWizardFromTemplate(t)}
                />
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Wizard dialog */}
      <Dialog
        open={wizard.open}
        onOpenChange={(o) => !o && setWizard(wizardInitial)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {wizard.mode === "custom"
                ? "Connecteur custom"
                : `Configurer ${wizard.template?.displayName ?? "le connecteur"}`}
            </DialogTitle>
            <DialogDescription>
              {wizard.mode === "custom"
                ? "Configure un connecteur OAuth 2.0 ou API key vers n'importe quel fournisseur."
                : wizard.template?.type === "api_key"
                  ? "Le connecteur utilisera une clé API que chaque utilisateur fournira après la création."
                  : "Le connecteur OAuth nécessite un client_id et un client_secret obtenus auprès du fournisseur."}
            </DialogDescription>
          </DialogHeader>

          {/* ── Custom: basics step ──────────────────────────────────────── */}
          {wizard.mode === "custom" && wizard.step === "basics" && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="customType">Type</Label>
                <Select
                  value={wizard.type}
                  onValueChange={(v) =>
                    setWizard((w) => ({ ...w, type: v as ConnectorType }))
                  }
                >
                  <SelectTrigger
                    id="customType"
                    data-testid="connectors-wizard-custom-type"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                    <SelectItem value="api_key">API Key / Bearer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customSlug">Slug fournisseur</Label>
                <Input
                  id="customSlug"
                  data-testid="connectors-wizard-custom-slug"
                  placeholder="acme-crm"
                  value={wizard.providerSlug}
                  onChange={(e) =>
                    setWizard((w) => ({
                      ...w,
                      providerSlug: e.target.value.toLowerCase(),
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Identifiant unique dans la company. Lettres minuscules, chiffres,
                  tirets uniquement.
                </p>
                {wizard.providerSlug.length > 0 && !slugValid && (
                  <p className="text-xs text-destructive mt-1">
                    Slug invalide — pattern attendu : a-z, 0-9, tirets.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customDisplayName">Nom affiché</Label>
                <Input
                  id="customDisplayName"
                  data-testid="connectors-wizard-display-name"
                  placeholder="ACME CRM"
                  value={wizard.displayName}
                  onChange={(e) =>
                    setWizard((w) => ({ ...w, displayName: e.target.value }))
                  }
                />
              </div>
            </div>
          )}

          {/* ── Custom: endpoints step (oauth2 only) ─────────────────────── */}
          {wizard.mode === "custom" &&
            wizard.step === "endpoints" &&
            wizard.type === "oauth2" && (
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="authorizationUrl">Authorization URL</Label>
                  <Input
                    id="authorizationUrl"
                    data-testid="connectors-wizard-authorization-url"
                    placeholder="https://provider.example.com/oauth/authorize"
                    value={wizard.authorizationUrl}
                    onChange={(e) =>
                      setWizard((w) => ({ ...w, authorizationUrl: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tokenUrl">Token URL</Label>
                  <Input
                    id="tokenUrl"
                    data-testid="connectors-wizard-token-url"
                    placeholder="https://provider.example.com/oauth/token"
                    value={wizard.tokenUrl}
                    onChange={(e) =>
                      setWizard((w) => ({ ...w, tokenUrl: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="userinfoUrl">Userinfo URL (optionnel)</Label>
                  <Input
                    id="userinfoUrl"
                    data-testid="connectors-wizard-userinfo-url"
                    placeholder="https://provider.example.com/api/me"
                    value={wizard.userinfoUrl}
                    onChange={(e) =>
                      setWizard((w) => ({ ...w, userinfoUrl: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="redirectUri">Redirect URI (optionnel)</Label>
                  <Input
                    id="redirectUri"
                    data-testid="connectors-wizard-redirect-uri"
                    placeholder="laisser vide pour utiliser MNM_PUBLIC_URL"
                    value={wizard.redirectUri}
                    onChange={(e) =>
                      setWizard((w) => ({ ...w, redirectUri: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="scopesText">Scopes</Label>
                  <Input
                    id="scopesText"
                    data-testid="connectors-wizard-scopes"
                    placeholder="read write offline_access"
                    value={wizard.scopesText}
                    onChange={(e) =>
                      setWizard((w) => ({ ...w, scopesText: e.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Séparés par espace ou virgule.
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="refreshSupported">Supporte refresh_token</Label>
                    <p className="text-xs text-muted-foreground">
                      Désactive si le fournisseur ne renvoie pas de refresh_token.
                    </p>
                  </div>
                  <Switch
                    id="refreshSupported"
                    data-testid="connectors-wizard-refresh-supported"
                    checked={wizard.refreshSupported}
                    onCheckedChange={(v) =>
                      setWizard((w) => ({ ...w, refreshSupported: v }))
                    }
                  />
                </div>
              </div>
            )}

          {/* ── Template: details step ──────────────────────────────────── */}
          {wizard.mode === "template" && wizard.step === "details" && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="displayName">Nom affiché</Label>
                <Input
                  id="displayName"
                  data-testid="connectors-wizard-display-name"
                  value={wizard.displayName}
                  onChange={(e) =>
                    setWizard((w) => ({ ...w, displayName: e.target.value }))
                  }
                />
              </div>

              {wizard.template?.type === "oauth2" && (
                <div className="space-y-1.5">
                  <Label>Scopes recommandés</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(wizard.template.scopes ?? []).map((scope) => {
                      const checked = wizard.scopes.includes(scope);
                      return (
                        <Badge
                          key={scope}
                          variant={checked ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() =>
                            setWizard((w) => ({
                              ...w,
                              scopes: checked
                                ? w.scopes.filter((s) => s !== scope)
                                : [...w.scopes, scope],
                            }))
                          }
                        >
                          {scope}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {wizard.template?.type === "api_key" && (
                <div className="space-y-1.5">
                  <Label htmlFor="apiKeyLabel">Libellé clé (env var)</Label>
                  <Input
                    id="apiKeyLabel"
                    data-testid="connectors-wizard-api-key-label"
                    value={wizard.apiKeyLabel}
                    onChange={(e) =>
                      setWizard((w) => ({ ...w, apiKeyLabel: e.target.value }))
                    }
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Credentials step (shared template oauth + custom oauth) ──── */}
          {wizard.step === "credentials" &&
            ((wizard.mode === "template" && wizard.template?.type === "oauth2") ||
              (wizard.mode === "custom" && wizard.type === "oauth2")) && (
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="clientId">Client ID</Label>
                  <Input
                    id="clientId"
                    data-testid="connectors-wizard-client-id"
                    value={wizard.clientId}
                    onChange={(e) =>
                      setWizard((w) => ({ ...w, clientId: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="clientSecret">Client Secret</Label>
                  <Input
                    id="clientSecret"
                    data-testid="connectors-wizard-client-secret"
                    type="password"
                    value={wizard.clientSecret}
                    onChange={(e) =>
                      setWizard((w) => ({ ...w, clientSecret: e.target.value }))
                    }
                  />
                </div>
                {wizard.mode === "template" && wizard.template?.docsUrl && (
                  <a
                    href={wizard.template.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:underline"
                  >
                    Configurer une OAuth app{" "}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}

          {/* ── Custom api_key credentials step ─────────────────────────── */}
          {wizard.mode === "custom" &&
            wizard.step === "credentials" &&
            wizard.type === "api_key" && (
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="apiKeyLabel">Libellé clé (env var)</Label>
                  <Input
                    id="apiKeyLabel"
                    data-testid="connectors-wizard-api-key-label"
                    placeholder="ACME_API_KEY"
                    value={wizard.apiKeyLabel}
                    onChange={(e) =>
                      setWizard((w) => ({ ...w, apiKeyLabel: e.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Étiquette affichée à l'utilisateur quand il fournira sa clé.
                  </p>
                </div>
              </div>
            )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setWizard(wizardInitial)}
              disabled={createMutation.isPending}
            >
              Annuler
            </Button>

            {/* Template oauth2 — details → credentials */}
            {wizard.mode === "template" &&
              wizard.template?.type === "oauth2" &&
              wizard.step === "details" && (
                <Button
                  onClick={() => setWizard((w) => ({ ...w, step: "credentials" }))}
                  data-testid="connectors-wizard-next"
                  disabled={wizard.displayName.trim().length === 0}
                >
                  Suivant
                </Button>
              )}

            {/* Custom — basics → (endpoints if oauth2, else credentials) */}
            {wizard.mode === "custom" && wizard.step === "basics" && (
              <Button
                onClick={() =>
                  setWizard((w) => ({
                    ...w,
                    step: w.type === "oauth2" ? "endpoints" : "credentials",
                  }))
                }
                data-testid="connectors-wizard-next"
                disabled={!customBasicsValid}
              >
                Suivant
              </Button>
            )}

            {/* Custom — endpoints → credentials */}
            {wizard.mode === "custom" && wizard.step === "endpoints" && (
              <Button
                onClick={() => setWizard((w) => ({ ...w, step: "credentials" }))}
                data-testid="connectors-wizard-next-2"
                disabled={!customEndpointsValid}
              >
                Suivant
              </Button>
            )}

            {/* Final submit:
                - template api_key (single step)
                - template oauth2 on credentials
                - custom on credentials */}
            {((wizard.mode === "template" &&
              (wizard.template?.type === "api_key" ||
                (wizard.template?.type === "oauth2" &&
                  wizard.step === "credentials"))) ||
              (wizard.mode === "custom" && wizard.step === "credentials")) && (
              <Button
                onClick={submitWizard}
                disabled={!canSubmitWizard || createMutation.isPending}
                data-testid="connectors-wizard-submit"
              >
                {createMutation.isPending ? "Création..." : "Créer le connecteur"}
              </Button>
            )}
          </DialogFooter>

          {createMutation.error && (
            <p className="text-sm text-destructive mt-2">
              {(createMutation.error as Error).message}
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le connecteur ?</DialogTitle>
            <DialogDescription>
              {deleteTarget?.displayName} sera supprimé. Tous les comptes utilisateur
              connectés via ce connecteur seront déconnectés (cascade).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              data-testid="connectors-delete-confirm"
            >
              {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GITHUB-PROVIDER Phase 5 — adaptive wizard for the github tile.
          Adaptive : if the connector already exists (e.g. user re-opens the
          Sheet via the "Reconfigurer" button), the wizard skips OAuth and
          jumps to the App banner / paste / install flow. */}
      <Dialog
        open={!!githubWizardTemplate}
        onOpenChange={(o) => !o && setGithubWizardTemplate(null)}
      >
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurer GitHub</DialogTitle>
            <DialogDescription>
              OAuth pour les comptes utilisateurs + GitHub App optionnelle pour
              les organisations privées.
            </DialogDescription>
          </DialogHeader>
          {githubWizardTemplate && (
            <GitHubConnectorWizard
              template={githubWizardTemplate}
              existingConnector={
                connectors.find((c) => c.providerSlug === "github") ?? null
              }
              onClose={() => setGithubWizardTemplate(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* GITHUB-PROVIDER Phase 5 — connector detail Sheet for the github
          provider. Shows the OAuth section + the optional App section with
          installations management. Reuses the wizard inline for «Reconfigurer». */}
      {githubSheet && (
        <GitHubConnectorSheet
          open
          onOpenChange={(o) => !o && setGithubSheet(null)}
          connector={githubSheet.connector}
          template={githubSheet.template}
        />
      )}
    </div>
  );
}

function TemplateCard({
  template,
  onClick,
}: {
  template: ConnectorTemplate;
  onClick: () => void;
}) {
  // GITHUB-PROVIDER Phase 5 (D6) — single tile for github, with a tooltip
  // pointing out the optional GitHub App for private orgs. No second tile —
  // the App is configured inside the same wizard.
  const isGithub = template.slug === "github";

  const card = (
    <Card
      className="cursor-pointer hover:border-primary transition-colors"
      onClick={onClick}
      data-testid={`connectors-template-${template.slug}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-1.5">
            {template.displayName}
            {isGithub && (
              <Info
                className="h-3.5 w-3.5 text-muted-foreground"
                data-testid="gh-app-tile-info-icon"
              />
            )}
          </CardTitle>
          <Badge variant={template.type === "oauth2" ? "default" : "secondary"}>
            {template.type === "oauth2" ? "OAuth" : "API Key"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-xs">{template.tagline}</CardDescription>
      </CardContent>
    </Card>
  );

  if (!isGithub) return card;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent side="top">
          Supporte les organisations privées via GitHub App optionnelle
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ConnectorRow({
  connector,
  onToggleEnabled,
  onDelete,
  onConfigure,
}: {
  connector: Connector;
  onToggleEnabled: (enabled: boolean) => void;
  onDelete: () => void;
  /**
   * GITHUB-PROVIDER Phase 5 — when the connector has a provider-specific
   * detail Sheet (e.g. github), parent passes a callback to open it. Other
   * connectors hide the button (`undefined`).
   */
  onConfigure?: () => void;
}) {
  return (
    <Card data-testid={`connectors-row-${connector.providerSlug}`}>
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          {connector.type === "api_key" ? (
            <KeyRound className="h-5 w-5 text-muted-foreground" />
          ) : (
            <Plug className="h-5 w-5 text-muted-foreground" />
          )}
          <div>
            <p className="font-medium">{connector.displayName}</p>
            <p className="text-xs text-muted-foreground">
              {connector.providerSlug}
              {connector.type === "oauth2" && connector.clientSecretConfigured
                ? " · client_secret configuré"
                : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant={connector.type === "oauth2" ? "default" : "secondary"}>
            {connector.type === "oauth2" ? "OAuth" : "API Key"}
          </Badge>
          <div className="flex items-center gap-2">
            <Switch
              checked={connector.enabled}
              onCheckedChange={onToggleEnabled}
              data-testid={`connectors-toggle-${connector.providerSlug}`}
            />
            <Label className="text-xs text-muted-foreground">
              {connector.enabled ? "Activé" : "Désactivé"}
            </Label>
          </div>
          {onConfigure && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onConfigure}
              data-testid={`connectors-configure-${connector.providerSlug}`}
              title="Configurer"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            data-testid={`connectors-delete-${connector.providerSlug}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
